import { Peer, DataConnection } from 'peerjs';
import { CanvasElement, CollabMessage, CollabMessageType, Collaborator, Point } from '../types';

const VIBRANT_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

const ADJECTIVES = ['Creative', 'Swift', 'Witty', 'Nimble', 'Bright', 'Cosmic', 'Daring', 'Epic', 'Jolly'];
const ANIMALS = ['Fox', 'Owl', 'Panda', 'Falcon', 'Otter', 'Lynx', 'Koala', 'Tiger', 'Dolphin'];

const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  },
};

export class CollaborationService {
  private static instance: CollaborationService | null = null;

  public localUser: Collaborator;
  public roomId: string = '';
  
  private broadcastChannel: BroadcastChannel | null = null;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private listeners: Array<(msg: CollabMessage) => void> = [];
  private collaboratorsMap: Map<string, Collaborator> = new Map();
  private onCollaboratorsChangeCallbacks: Array<(collaborators: Collaborator[]) => void> = [];

  private constructor() {
    // Generate or fetch guest identity
    let savedId = localStorage.getItem('scribble_collab_id');
    if (!savedId) {
      savedId = `user_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('scribble_collab_id', savedId);
    }

    let savedName = localStorage.getItem('scribble_collab_name');
    if (!savedName) {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      savedName = `${adj} ${animal}`;
      localStorage.setItem('scribble_collab_name', savedName);
    }

    const savedColor = VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];

    this.localUser = {
      id: savedId,
      name: savedName,
      color: savedColor,
      lastActive: Date.now(),
    };
  }

  public static getInstance(): CollaborationService {
    if (!this.instance) {
      this.instance = new CollaborationService();
    }
    return this.instance;
  }

  public initRoom(roomIdFromUrl?: string): string {
    // Determine room ID from URL search param or hash
    let room = roomIdFromUrl;
    if (!room) {
      const urlParams = new URLSearchParams(window.location.search);
      room = urlParams.get('room') || '';
    }

    if (!room) {
      // Auto generate room ID if none present
      room = `room-${Math.random().toString(36).substring(2, 8)}`;
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', room);
      window.history.replaceState({}, '', newUrl.toString());
    }

    this.roomId = room;

    // Set up BroadcastChannel for local multi-tab real-time sync
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    this.broadcastChannel = new BroadcastChannel(`scribble_room_${this.roomId}`);
    this.broadcastChannel.onmessage = (event) => {
      this.handleIncomingMessage(event.data);
    };

    // Set up PeerJS for cross-device / remote WebRTC sync
    this.initPeerJS();

    // Broadcast JOIN_ROOM message
    this.broadcastMessage('JOIN_ROOM', { user: this.localUser });

    // Periodically clean up inactive collaborators (older than 10s)
    setInterval(() => {
      let changed = false;
      const now = Date.now();
      this.collaboratorsMap.forEach((collab, id) => {
        if (id !== this.localUser.id && now - collab.lastActive > 10000) {
          this.collaboratorsMap.delete(id);
          changed = true;
        }
      });
      if (changed) {
        this.notifyCollaboratorsChanged();
      }
    }, 3000);

    return this.roomId;
  }

  private initPeerJS() {
    try {
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
      
      const peerId = `scribble_${this.roomId}_${this.localUser.id}`;
      const peer = new Peer(peerId, PEER_CONFIG);
      this.peer = peer;
      this.setupPeerListeners(peer);
    } catch (e) {
      console.warn('PeerJS failed to initialize:', e);
    }
  }

  private setupPeerListeners(peer: Peer) {
    peer.on('open', (id) => {
      console.log('PeerJS connected with ID:', id);
      // Only act if this is still the active peer
      if (this.peer === peer) {
        this.connectToRoomHost();
      }
    });

    peer.on('connection', (conn) => {
      this.setupConnection(conn);
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && this.peer === peer) {
        // Retry with a random suffix to avoid ID collision
        const altId = `scribble_${this.roomId}_${this.localUser.id}_${Math.floor(Math.random() * 9999)}`;
        try {
          const newPeer = new Peer(altId, PEER_CONFIG);
          this.peer = newPeer;
          this.setupPeerListeners(newPeer);
        } catch (e) {
          console.warn('PeerJS retry failed:', e);
        }
      }
    });

    peer.on('disconnected', () => {
      // Attempt reconnect if this is still the active peer
      if (this.peer === peer && !peer.destroyed) {
        try { peer.reconnect(); } catch (_) { /* ignore */ }
      }
    });
  }

  private connectToRoomHost() {
    if (!this.peer) return;
    const hostPeerId = `scribble_host_${this.roomId}`;
    if (this.peer.id !== hostPeerId) {
      const conn = this.peer.connect(hostPeerId, { reliable: true });
      if (conn) {
        this.setupConnection(conn);
      }
    }
  }

  private setupConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    conn.on('open', () => {
      // Send JOIN_ROOM upon connection open
      conn.send({
        type: 'JOIN_ROOM',
        senderId: this.localUser.id,
        senderName: this.localUser.name,
        senderColor: this.localUser.color,
        roomId: this.roomId,
        payload: { user: this.localUser },
        timestamp: Date.now(),
      });
    });

    conn.on('data', (data: any) => {
      this.handleIncomingMessage(data as CollabMessage);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
    });
  }

  public subscribe(listener: (msg: CollabMessage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public onCollaboratorsChange(callback: (collaborators: Collaborator[]) => void): () => void {
    this.onCollaboratorsChangeCallbacks.push(callback);
    callback(Array.from(this.collaboratorsMap.values()));
    return () => {
      this.onCollaboratorsChangeCallbacks = this.onCollaboratorsChangeCallbacks.filter(c => c !== callback);
    };
  }

  private notifyCollaboratorsChanged() {
    const list = Array.from(this.collaboratorsMap.values());
    this.onCollaboratorsChangeCallbacks.forEach(cb => cb(list));
  }

  public broadcastMessage(type: CollabMessageType, payload: any) {
    const message: CollabMessage = {
      type,
      senderId: this.localUser.id,
      senderName: this.localUser.name,
      senderColor: this.localUser.color,
      roomId: this.roomId,
      payload,
      timestamp: Date.now(),
    };

    // 1. BroadcastChannel (Same-device Multi-tab)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (e) {
        console.error('BroadcastChannel error:', e);
      }
    }

    // 2. PeerJS DataConnections (Cross-device WebRTC)
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(message);
        } catch (e) {
          console.error('PeerJS send error:', e);
        }
      }
    });
  }

  public broadcastCursor(point: Point) {
    this.localUser.cursor = point;
    this.broadcastMessage('CURSOR_MOVE', { point });
  }

  public broadcastElements(elements: CanvasElement[]) {
    this.broadcastMessage('ELEMENTS_UPDATE', { elements });
  }

  public broadcastClearCanvas() {
    this.broadcastMessage('CLEAR_CANVAS', {});
  }

  public broadcastBgColor(bgColor: string) {
    this.broadcastMessage('CHANGE_BG_COLOR', { bgColor });
  }

  public broadcastGridType(gridType: string) {
    this.broadcastMessage('CHANGE_GRID_TYPE', { gridType });
  }

  private handleIncomingMessage(msg: CollabMessage) {
    if (!msg || !msg.senderId || msg.senderId === this.localUser.id) return;
    if (msg.roomId !== this.roomId) return;

    // Track collaborator presence
    const collab: Collaborator = {
      id: msg.senderId,
      name: msg.senderName,
      color: msg.senderColor,
      cursor: msg.type === 'CURSOR_MOVE' ? msg.payload?.point : this.collaboratorsMap.get(msg.senderId)?.cursor,
      lastActive: Date.now(),
    };
    this.collaboratorsMap.set(msg.senderId, collab);
    this.notifyCollaboratorsChanged();

    // If new peer joined, notify listeners so room host can sync state
    if (msg.type === 'JOIN_ROOM') {
      this.listeners.forEach(l => l(msg));
      return;
    }

    // Notify UI listeners
    this.listeners.forEach(l => l(msg));
  }

  public updateLocalUserName(newName: string) {
    if (!newName.trim()) return;
    this.localUser.name = newName.trim();
    localStorage.setItem('scribble_collab_name', this.localUser.name);
    this.broadcastMessage('JOIN_ROOM', { user: this.localUser });
  }

  public getShareableUrl(): string {
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.roomId);
    return url.toString();
  }
}
