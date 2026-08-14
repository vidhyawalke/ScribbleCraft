/**
 * CollaborationService — Firebase Realtime Database edition
 *
 * Architecture
 * ─────────────
 * Layer 1 — BroadcastChannel  (same browser, zero latency, always on)
 * Layer 2 — Firebase RTDB      (cross-device / cross-network, ~50 ms latency)
 *
 * Firebase data layout
 * ─────────────────────
 * /rooms/{roomId}/
 *   state/
 *     writerId   : string          ← prevents our own writes from looping back
 *     writerName : string
 *     writerColor: string
 *     timestamp  : number
 *     elements   : CanvasElement[]
 *   presence/
 *     {userId}/
 *       id        : string
 *       name      : string
 *       color     : string
 *       lastActive: number
 *       cursor    : { x, y } | null
 *
 * When a user closes/refreshes the tab, onDisconnect() automatically removes
 * their presence node so other users stop seeing them as "online".
 */

import { ref, set, onValue, onDisconnect, DatabaseReference } from 'firebase/database';
import { db, isFirebaseConfigured } from './firebaseConfig';
import { CanvasElement, CollabMessage, CollabMessageType, Collaborator, Point } from '../types';

// ─── Identity helpers ─────────────────────────────────────────────────────────

const VIBRANT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

const ADJECTIVES = ['Creative', 'Swift', 'Witty', 'Nimble', 'Bright', 'Cosmic', 'Daring', 'Epic', 'Jolly'];
const ANIMALS    = ['Fox', 'Owl', 'Panda', 'Falcon', 'Otter', 'Lynx', 'Koala', 'Tiger', 'Dolphin'];

// ─────────────────────────────────────────────────────────────────────────────

export class CollaborationService {
  private static instance: CollaborationService | null = null;

  public localUser: Collaborator;
  public roomId: string = '';

  // ── BroadcastChannel (same-device multi-tab) ─────────────────────────────
  private broadcastChannel: BroadcastChannel | null = null;

  // ── Firebase references ──────────────────────────────────────────────────
  private stateRef:       DatabaseReference | null = null;
  private presenceRef:    DatabaseReference | null = null;
  private presenceRoomRef: DatabaseReference | null = null;
  private firebaseUnsubs: Array<() => void> = [];

  // ── Debounce timers ──────────────────────────────────────────────────────
  private elementsTimer: ReturnType<typeof setTimeout>  | null = null;
  private cursorTimer:   ReturnType<typeof setTimeout>  | null = null;
  private heartbeat:     ReturnType<typeof setInterval> | null = null;

  // ── Listeners ────────────────────────────────────────────────────────────
  private messageListeners: Array<(msg: CollabMessage) => void> = [];
  private collaboratorsMap: Map<string, Collaborator>           = new Map();
  private collabChangeCallbacks: Array<(list: Collaborator[]) => void> = [];

  // ─────────────────────────────────────────────────────────────────────────

  private constructor() {
    let savedId = localStorage.getItem('scribble_collab_id');
    if (!savedId) {
      savedId = `user_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('scribble_collab_id', savedId);
    }

    let savedName = localStorage.getItem('scribble_collab_name');
    if (!savedName) {
      const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      savedName    = `${adj} ${animal}`;
      localStorage.setItem('scribble_collab_name', savedName);
    }

    const color = VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];

    this.localUser = { id: savedId, name: savedName, color, lastActive: Date.now() };
  }

  public static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }

  // ─── Room initialisation ──────────────────────────────────────────────────

  public initRoom(roomIdFromUrl?: string): string {
    // Resolve room ID from URL param or generate a fresh one
    let room = roomIdFromUrl;
    if (!room) {
      const params = new URLSearchParams(window.location.search);
      room = params.get('room') || '';
    }
    if (!room) {
      room = `room-${Math.random().toString(36).substring(2, 8)}`;
      const url = new URL(window.location.href);
      url.searchParams.set('room', room);
      window.history.replaceState({}, '', url.toString());
    }
    this.roomId = room;

    // ── BroadcastChannel for same-device tabs ─────────────────────────────
    this.broadcastChannel?.close();
    this.broadcastChannel = new BroadcastChannel(`scribble_room_${this.roomId}`);
    this.broadcastChannel.onmessage = (ev) => this.handleIncomingMessage(ev.data);

    // ── Firebase for cross-device ─────────────────────────────────────────
    this.initFirebase();

    // Announce presence to same-device tabs
    this.postToBroadcastChannel('JOIN_ROOM', { user: this.localUser });

    // Periodically remove stale local collaborator entries
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      this.collaboratorsMap.forEach((c, id) => {
        if (id !== this.localUser.id && now - c.lastActive > 30_000) {
          this.collaboratorsMap.delete(id);
          changed = true;
        }
      });
      if (changed) this.notifyCollabChange();
    }, 8_000);

    return this.roomId;
  }

  // ─── Firebase initialisation ──────────────────────────────────────────────

  private initFirebase() {
    if (!db || !isFirebaseConfigured) {
      console.info(
        '%c[ScribbleCraft] Firebase not configured.\n' +
        'Cross-device collaboration is disabled.\n' +
        'Add VITE_FIREBASE_* vars to .env (local) or Vercel → Settings → Env Vars.',
        'color: #f59e0b; font-weight: bold;'
      );
      return;
    }

    // Clean up any previous listeners
    this.firebaseUnsubs.forEach(u => u());
    this.firebaseUnsubs = [];

    this.stateRef        = ref(db, `rooms/${this.roomId}/state`);
    this.presenceRef     = ref(db, `rooms/${this.roomId}/presence/${this.localUser.id}`);
    this.presenceRoomRef = ref(db, `rooms/${this.roomId}/presence`);

    // ── Write my presence ─────────────────────────────────────────────────
    const myPresence = {
      id:         this.localUser.id,
      name:       this.localUser.name,
      color:      this.localUser.color,
      lastActive: Date.now(),
      cursor:     null,
    };
    set(this.presenceRef, myPresence).catch(console.error);
    // Auto-remove on tab close / refresh
    onDisconnect(this.presenceRef).remove();

    // ── Listen for canvas state changes from other users ──────────────────
    const unsubState = onValue(this.stateRef, (snap) => {
      const data = snap.val() as {
        writerId: string;
        writerName: string;
        writerColor: string;
        timestamp: number;
        elements: CanvasElement[];
      } | null;

      if (!data) return;
      // IMPORTANT: skip our own writes to prevent echo loops
      if (data.writerId === this.localUser.id) return;
      if (!Array.isArray(data.elements)) return;

      const msg: CollabMessage = {
        type:        'ELEMENTS_UPDATE',
        senderId:    data.writerId    || 'remote',
        senderName:  data.writerName  || 'Remote User',
        senderColor: data.writerColor || '#6366f1',
        roomId:      this.roomId,
        payload:     { elements: data.elements },
        timestamp:   data.timestamp   || Date.now(),
      };
      this.messageListeners.forEach(l => l(msg));
    });
    this.firebaseUnsubs.push(unsubState);

    // ── Listen for presence / cursor updates from everyone else ───────────
    const unsubPresence = onValue(this.presenceRoomRef!, (snap) => {
      const data = snap.val() as Record<string, any> | null;
      if (!data) return;

      const now = Date.now();
      const seen = new Set<string>();

      Object.values(data).forEach((user: any) => {
        if (!user?.id || user.id === this.localUser.id) return;
        if (now - (user.lastActive ?? 0) > 30_000) return; // stale

        seen.add(user.id);
        this.collaboratorsMap.set(user.id, {
          id:         user.id,
          name:       user.name   || 'Unknown',
          color:      user.color  || '#6366f1',
          cursor:     user.cursor ?? this.collaboratorsMap.get(user.id)?.cursor,
          lastActive: user.lastActive ?? now,
        });
      });

      // Remove users who disappeared from presence
      this.collaboratorsMap.forEach((_, id) => {
        if (!seen.has(id)) this.collaboratorsMap.delete(id);
      });

      this.notifyCollabChange();
    });
    this.firebaseUnsubs.push(unsubPresence);

    // ── Heartbeat: refresh lastActive every 10 s ──────────────────────────
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (!db || !this.presenceRef) return;
      set(ref(db, `rooms/${this.roomId}/presence/${this.localUser.id}/lastActive`), Date.now())
        .catch(() => { /* ignore; tab may be closing */ });
    }, 10_000);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public subscribe(listener: (msg: CollabMessage) => void): () => void {
    this.messageListeners.push(listener);
    return () => { this.messageListeners = this.messageListeners.filter(l => l !== listener); };
  }

  public onCollaboratorsChange(callback: (list: Collaborator[]) => void): () => void {
    this.collabChangeCallbacks.push(callback);
    callback(Array.from(this.collaboratorsMap.values())); // immediate snapshot
    return () => { this.collabChangeCallbacks = this.collabChangeCallbacks.filter(c => c !== callback); };
  }

  /**
   * Sync canvas elements to all collaborators.
   * - BroadcastChannel: instant (same browser)
   * - Firebase: debounced 200 ms (cross-device)
   */
  public broadcastElements(elements: CanvasElement[]) {
    // Layer 1 — instant same-device sync
    this.postToBroadcastChannel('ELEMENTS_UPDATE', { elements });

    // Layer 2 — Firebase cross-device sync (debounced to reduce writes)
    if (!db || !isFirebaseConfigured || !this.stateRef) return;

    if (this.elementsTimer) clearTimeout(this.elementsTimer);
    this.elementsTimer = setTimeout(() => {
      // Strip base64 image data from elements > 1 MB to avoid Firebase limits.
      // Images are stored locally and are not needed for remote state.
      const safeElements = elements.map(el => {
        if (el.type === 'image' && el.imageUrl && el.imageUrl.length > 200_000) {
          return { ...el, imageUrl: '' }; // placeholder; remote sees blank image slot
        }
        return el;
      });

      set(this.stateRef!, {
        writerId:    this.localUser.id,
        writerName:  this.localUser.name,
        writerColor: this.localUser.color,
        timestamp:   Date.now(),
        elements:    safeElements,
      }).catch(e => console.warn('[ScribbleCraft] Firebase write failed:', e));
    }, 200);
  }

  /**
   * Broadcast cursor position.
   * - BroadcastChannel: instant
   * - Firebase: debounced 80 ms  (high-frequency, keep writes cheap)
   */
  public broadcastCursor(point: Point) {
    this.localUser.cursor = point;
    this.postToBroadcastChannel('CURSOR_MOVE', { point });

    if (!db || !isFirebaseConfigured) return;
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.cursorTimer = setTimeout(() => {
      if (!db) return;
      set(ref(db, `rooms/${this.roomId}/presence/${this.localUser.id}/cursor`), point).catch(() => {});
    }, 80);
  }

  public broadcastClearCanvas() {
    this.broadcastElements([]);
  }

  public broadcastBgColor(bgColor: string) {
    this.postToBroadcastChannel('CHANGE_BG_COLOR', { bgColor });
  }

  public broadcastGridType(gridType: string) {
    this.postToBroadcastChannel('CHANGE_GRID_TYPE', { gridType });
  }

  public updateLocalUserName(newName: string) {
    if (!newName.trim()) return;
    this.localUser.name = newName.trim();
    localStorage.setItem('scribble_collab_name', this.localUser.name);

    // Update Firebase presence name immediately
    if (db && isFirebaseConfigured) {
      set(ref(db, `rooms/${this.roomId}/presence/${this.localUser.id}/name`), this.localUser.name).catch(() => {});
    }
    this.postToBroadcastChannel('JOIN_ROOM', { user: this.localUser });
  }

  public getShareableUrl(): string {
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.roomId);
    return url.toString();
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  /** Post a CollabMessage to same-device tabs only. */
  private postToBroadcastChannel(type: CollabMessageType, payload: any) {
    if (!this.broadcastChannel) return;
    const msg: CollabMessage = {
      type,
      senderId:    this.localUser.id,
      senderName:  this.localUser.name,
      senderColor: this.localUser.color,
      roomId:      this.roomId,
      payload,
      timestamp:   Date.now(),
    };
    try { this.broadcastChannel.postMessage(msg); } catch { /* ignore */ }
  }

  /** Handle a message arriving from BroadcastChannel (same device). */
  private handleIncomingMessage(msg: CollabMessage) {
    if (!msg?.senderId || msg.senderId === this.localUser.id) return;
    if (msg.roomId !== this.roomId) return;

    // Track this collaborator locally
    this.collaboratorsMap.set(msg.senderId, {
      id:         msg.senderId,
      name:       msg.senderName,
      color:      msg.senderColor,
      cursor:     msg.type === 'CURSOR_MOVE' ? msg.payload?.point : this.collaboratorsMap.get(msg.senderId)?.cursor,
      lastActive: Date.now(),
    });
    this.notifyCollabChange();

    // Forward to all UI subscribers
    this.messageListeners.forEach(l => l(msg));
  }

  private notifyCollabChange() {
    const list = Array.from(this.collaboratorsMap.values());
    this.collabChangeCallbacks.forEach(cb => cb(list));
  }
}
