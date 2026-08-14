/**
 * CollaborationService — Hybrid Socket.io + WebRTC (PeerJS) Real-Time Engine
 *
 * Architecture
 * ─────────────
 * 1. Layer 1 — BroadcastChannel : Instant zero-latency sync for tabs on the same browser.
 * 2. Layer 2 — Socket.io Server : Ultra-low latency WebSocket rooms (active when server is available/configured).
 * 3. Layer 3 — WebRTC PeerJS     : Zero-config serverless P2P mesh (works out of the box on Vercel, Netlify, etc. without needing a backend server!).
 *
 * This ensures real-time cross-device collaboration works BOTH:
 * - Locally in development (Socket.io / BroadcastChannel)
 * - In production deployments on static hosts (WebRTC DataChannel P2P)
 * - On full-stack cloud deployments (Render, Railway, Fly.io, etc.)
 */

import { io, Socket } from 'socket.io-client';
import Peer, { DataConnection } from 'peerjs';
import { CanvasElement, CollabMessage, CollabMessageType, Collaborator, Point, ConnectionStatus } from '../types';

// ─── Identity Helpers ─────────────────────────────────────────────────────────

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
  public connectionStatus: ConnectionStatus = 'disconnected';
  public activeTransport: 'socket.io' | 'webrtc' | 'broadcast' | 'none' = 'none';

  // ── Layer 1: BroadcastChannel (same-device multi-tab) ───────────────────
  private broadcastChannel: BroadcastChannel | null = null;

  // ── Layer 2: Socket.io Client ───────────────────────────────────────────
  private socket: Socket | null = null;
  private socketConnectTimeout: number | null = null;

  // ── Layer 3: WebRTC PeerJS Client ───────────────────────────────────────
  private peer: Peer | null = null;
  private peerConnections: Map<string, DataConnection> = new Map();
  private isPeerHost: boolean = false;
  private hostConnection: DataConnection | null = null;
  private peerRetryTimer: number | null = null;

  // ── Throttling & Queues ──────────────────────────────────────────────────
  private cursorThrottleTimer: number | null = null;
  private pendingCursorPoint: Point | null = null;

  // ── Subscriptions & State ────────────────────────────────────────────────
  private messageListeners: Array<(msg: CollabMessage) => void> = [];
  private collaboratorsMap: Map<string, Collaborator> = new Map();
  private collabChangeCallbacks: Array<(list: Collaborator[]) => void> = [];
  private statusChangeCallbacks: Array<(status: ConnectionStatus, transport?: string) => void> = [];

  // Cached board state for newly joined peers
  private currentElements: CanvasElement[] = [];
  private currentBgColor: string = '#fdfbf7';
  private currentGridType: string = 'dots';

  // ─────────────────────────────────────────────────────────────────────────

  private constructor() {
    let savedId = localStorage.getItem('scribble_collab_id');
    if (!savedId) {
      savedId = `u_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('scribble_collab_id', savedId);
    }

    let savedName = localStorage.getItem('scribble_collab_name');
    if (!savedName) {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      savedName = `${adj} ${animal}`;
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

  // ─── Room Initialization ──────────────────────────────────────────────────

  public initRoom(
    roomIdFromUrl?: string,
    initialElements?: CanvasElement[],
    bgColor?: string,
    gridType?: string
  ): string {
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

    if (Array.isArray(initialElements)) this.currentElements = initialElements;
    if (bgColor) this.currentBgColor = bgColor;
    if (gridType) this.currentGridType = gridType;

    // 1. Initialize BroadcastChannel (always on for same-browser instant sync)
    this.broadcastChannel?.close();
    this.broadcastChannel = new BroadcastChannel(`scribble_room_${this.roomId}`);
    this.broadcastChannel.onmessage = (ev) => this.handleIncomingMessage(ev.data, 'broadcast');
    this.postToBroadcastChannel('JOIN_ROOM', { user: this.localUser });

    // 2. Start Hybrid Real-Time Transports
    this.startHybridConnection(initialElements, bgColor, gridType);

    // 3. Stale collaborator cleanup timer
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      this.collaboratorsMap.forEach((c, id) => {
        if (id !== this.localUser.id && now - c.lastActive > 35_000) {
          this.collaboratorsMap.delete(id);
          changed = true;
        }
      });
      if (changed) this.notifyCollabChange();
    }, 8_000);

    return this.roomId;
  }

  // ─── Hybrid Connection Manager ────────────────────────────────────────────

  private startHybridConnection(initialElements?: CanvasElement[], bgColor?: string, gridType?: string) {
    this.setConnectionStatus('connecting');

    const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL;
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.');

    const targetSocketUrl = explicitSocketUrl || (isLocalhost ? `http://${window.location.hostname}:3001` : null);

    if (targetSocketUrl) {
      this.initSocket(targetSocketUrl, initialElements, bgColor, gridType);
      // If Socket.io does not connect within 3.5 seconds, start WebRTC P2P fallback
      if (this.socketConnectTimeout) clearTimeout(this.socketConnectTimeout);
      this.socketConnectTimeout = window.setTimeout(() => {
        if (this.activeTransport !== 'socket.io') {
          console.info('[ScribbleCraft] Socket.io server not reachable. Activating WebRTC P2P mesh fallback...');
          this.initWebRTCMesh();
        }
      }, 3500);
    } else {
      // In production static hosting (e.g. Vercel without custom VITE_SOCKET_URL), use WebRTC P2P directly
      this.initWebRTCMesh();
    }
  }

  // ─── Layer 2: Socket.io Engine ────────────────────────────────────────────

  private initSocket(socketUrl: string, _initialElements?: CanvasElement[], _bgColor?: string, _gridType?: string) {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    try {
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.activeTransport = 'socket.io';
        this.setConnectionStatus('connected');

        this.socket?.emit('join-room', {
          roomId: this.roomId,
          user: this.localUser,
          initialElements: this.currentElements,
          bgColor: this.currentBgColor,
          gridType: this.currentGridType,
        });
      });

      this.socket.on('connect_error', () => {
        if (this.activeTransport !== 'socket.io') {
          // Fall back to WebRTC
          this.initWebRTCMesh();
        }
      });

      this.socket.on('disconnect', () => {
        if (this.activeTransport === 'socket.io') {
          this.setConnectionStatus('connecting');
          // Try WebRTC if socket goes down
          this.initWebRTCMesh();
        }
      });

      this.socket.on('sync-state', (data: any) => {
        if (!data || data.roomId !== this.roomId) return;
        if (Array.isArray(data.elements)) this.currentElements = data.elements;
        if (data.bgColor) this.currentBgColor = data.bgColor;
        if (data.gridType) this.currentGridType = data.gridType;

        if (Array.isArray(data.collaborators)) {
          this.syncCollaborators(data.collaborators);
        }

        const msg: CollabMessage = {
          type: 'SYNC_STATE',
          senderId: 'server',
          senderName: 'Server',
          senderColor: '#6366f1',
          roomId: this.roomId,
          payload: {
            elements: data.elements,
            bgColor: data.bgColor,
            gridType: data.gridType,
          },
          timestamp: Date.now(),
        };
        this.messageListeners.forEach((l) => l(msg));
      });

      this.socket.on('elements-update', (data: any) => {
        if (!data || data.roomId !== this.roomId) return;
        if (data.writerId === this.localUser.id) return;
        if (Array.isArray(data.elements)) this.currentElements = data.elements;

        const msg: CollabMessage = {
          type: 'ELEMENTS_UPDATE',
          senderId: data.writerId || 'remote',
          senderName: data.writerName || 'Remote User',
          senderColor: data.writerColor || '#6366f1',
          roomId: this.roomId,
          payload: { elements: data.elements },
          timestamp: data.timestamp || Date.now(),
        };
        this.messageListeners.forEach((l) => l(msg));
      });

      this.socket.on('cursor-move', (data: any) => {
        if (!data || data.roomId !== this.roomId) return;
        if (data.userId === this.localUser.id) return;

        const id = data.userId || data.socketId;
        this.collaboratorsMap.set(id, {
          id,
          name: data.userName || 'Collaborator',
          color: data.userColor || '#6366f1',
          cursor: data.point,
          lastActive: Date.now(),
        });
        this.notifyCollabChange();
      });

      this.socket.on('collaborators-update', (data: any) => {
        if (!data || data.roomId !== this.roomId) return;
        if (Array.isArray(data.collaborators)) {
          this.syncCollaborators(data.collaborators);
        }
      });

      this.socket.on('clear-canvas', (data: any) => {
        if (!data || data.roomId !== this.roomId) return;
        if (data.userId === this.localUser.id) return;
        this.currentElements = [];

        const msg: CollabMessage = {
          type: 'CLEAR_CANVAS',
          senderId: data.userId || 'remote',
          senderName: 'Remote User',
          senderColor: '#6366f1',
          roomId: this.roomId,
          payload: {},
          timestamp: data.timestamp || Date.now(),
        };
        this.messageListeners.forEach((l) => l(msg));
      });

      this.socket.on('canvas-settings-changed', (data: any) => {
        if (!data || data.roomId !== this.roomId) return;
        if (data.bgColor) {
          this.currentBgColor = data.bgColor;
          this.messageListeners.forEach((l) =>
            l({
              type: 'CHANGE_BG_COLOR',
              senderId: 'remote',
              senderName: 'Remote User',
              senderColor: '#6366f1',
              roomId: this.roomId,
              payload: { bgColor: data.bgColor },
              timestamp: Date.now(),
            })
          );
        }
        if (data.gridType) {
          this.currentGridType = data.gridType;
          this.messageListeners.forEach((l) =>
            l({
              type: 'CHANGE_GRID_TYPE',
              senderId: 'remote',
              senderName: 'Remote User',
              senderColor: '#6366f1',
              roomId: this.roomId,
              payload: { gridType: data.gridType },
              timestamp: Date.now(),
            })
          );
        }
      });
    } catch {
      this.initWebRTCMesh();
    }
  }

  // ─── Layer 3: Serverless WebRTC P2P Mesh (PeerJS) ──────────────────────────

  private initWebRTCMesh() {
    if (this.peer && !this.peer.destroyed) return;

    // Clean room ID for valid PeerJS ID (alphanumeric and hyphens only)
    const cleanRoom = this.roomId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
    const hostPeerId = `sc-host-${cleanRoom}`;
    const myPeerId = `sc-peer-${cleanRoom}-${this.localUser.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    try {
      // First, attempt to claim the Host ID for this room
      this.peer = new Peer(hostPeerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', (_id) => {
        this.isPeerHost = true;
        if (this.activeTransport !== 'socket.io') {
          this.activeTransport = 'webrtc';
          this.setConnectionStatus('connected');
        }
        this.setupPeerListeners();
      });

      this.peer.on('error', (err: any) => {
        // If host ID is already claimed by someone else in this room, join as a Peer!
        if (err.type === 'unavailable-id') {
          this.peer?.destroy();
          this.joinAsPeer(myPeerId, hostPeerId);
        } else {
          console.warn('[ScribbleCraft] WebRTC peer error:', err);
          if (this.activeTransport === 'none') {
            this.setConnectionStatus('disconnected');
          }
        }
      });
    } catch (err) {
      console.warn('[ScribbleCraft] PeerJS init error:', err);
      if (this.activeTransport === 'none') {
        this.setConnectionStatus('disconnected');
      }
    }
  }

  private joinAsPeer(myPeerId: string, hostPeerId: string) {
    try {
      this.peer = new Peer(myPeerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', () => {
        this.isPeerHost = false;
        if (this.activeTransport !== 'socket.io') {
          this.activeTransport = 'webrtc';
          this.setConnectionStatus('connected');
        }
        this.setupPeerListeners();

        // Connect to the room host
        this.connectToHost(hostPeerId);
      });

      this.peer.on('error', (err) => {
        console.warn('[ScribbleCraft] Peer client error:', err);
        if (this.activeTransport === 'webrtc') {
          this.setConnectionStatus('disconnected');
        }
      });
    } catch (err) {
      console.warn('[ScribbleCraft] Join as peer failed:', err);
    }
  }

  private connectToHost(hostPeerId: string) {
    if (!this.peer || this.peer.destroyed) return;

    try {
      const conn = this.peer.connect(hostPeerId, {
        reliable: true,
      });

      this.hostConnection = conn;
      this.handleConnection(conn);

      conn.on('open', () => {
        if (this.activeTransport !== 'socket.io') {
          this.activeTransport = 'webrtc';
          this.setConnectionStatus('connected');
        }

        // Send local profile and request sync from host
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

      conn.on('close', () => {
        this.peerConnections.delete(hostPeerId);
        this.hostConnection = null;

        // If host disconnected, attempt to claim host status or reconnect
        if (this.peerRetryTimer) clearTimeout(this.peerRetryTimer);
        this.peerRetryTimer = window.setTimeout(() => {
          if (this.activeTransport === 'webrtc' && !this.hostConnection) {
            this.peer?.destroy();
            this.initWebRTCMesh();
          }
        }, 3000);
      });
    } catch (err) {
      console.warn('[ScribbleCraft] Failed to connect to room host:', err);
    }
  }

  private setupPeerListeners() {
    if (!this.peer) return;

    this.peer.on('connection', (conn) => {
      this.handleConnection(conn);

      conn.on('open', () => {
        // If we are host, send canonical room state to newly connected peer
        if (this.isPeerHost) {
          conn.send({
            type: 'SYNC_STATE',
            senderId: this.localUser.id,
            senderName: this.localUser.name,
            senderColor: this.localUser.color,
            roomId: this.roomId,
            payload: {
              elements: this.currentElements,
              bgColor: this.currentBgColor,
              gridType: this.currentGridType,
              collaborators: Array.from(this.collaboratorsMap.values()),
            },
            timestamp: Date.now(),
          });
        }
      });
    });
  }

  private handleConnection(conn: DataConnection) {
    const peerId = conn.peer;
    this.peerConnections.set(peerId, conn);

    conn.on('data', (data: any) => {
      if (data && typeof data === 'object') {
        const msg = data as CollabMessage;
        this.handleIncomingMessage(msg, 'webrtc');

        // If we are host, forward message to all other connected peers (Star topology mesh)
        if (this.isPeerHost) {
          this.peerConnections.forEach((otherConn, otherId) => {
            if (otherId !== peerId && otherConn.open) {
              try {
                otherConn.send(data);
              } catch {
                /* ignore */
              }
            }
          });
        }
      }
    });

    conn.on('close', () => {
      this.peerConnections.delete(peerId);
      this.notifyCollabChange();
    });

    conn.on('error', () => {
      this.peerConnections.delete(peerId);
    });
  }

  // ─── Incoming Message Router ──────────────────────────────────────────────

  private handleIncomingMessage(msg: CollabMessage, _source: 'socket.io' | 'webrtc' | 'broadcast') {
    if (!msg?.senderId || msg.senderId === this.localUser.id) return;
    if (msg.roomId && msg.roomId !== this.roomId) return;

    // Track collaborator presence
    const now = Date.now();
    const existing = this.collaboratorsMap.get(msg.senderId);

    this.collaboratorsMap.set(msg.senderId, {
      id: msg.senderId,
      name: msg.senderName || existing?.name || 'Collaborator',
      color: msg.senderColor || existing?.color || '#6366f1',
      cursor: msg.type === 'CURSOR_MOVE' ? msg.payload?.point : existing?.cursor,
      lastActive: now,
    });
    this.notifyCollabChange();

    // Cache local state
    if (msg.type === 'ELEMENTS_UPDATE' && Array.isArray(msg.payload?.elements)) {
      this.currentElements = msg.payload.elements;
    } else if (msg.type === 'CLEAR_CANVAS') {
      this.currentElements = [];
    } else if (msg.type === 'CHANGE_BG_COLOR' && msg.payload?.bgColor) {
      this.currentBgColor = msg.payload.bgColor;
    } else if (msg.type === 'CHANGE_GRID_TYPE' && msg.payload?.gridType) {
      this.currentGridType = msg.payload.gridType;
    } else if (msg.type === 'SYNC_STATE' && Array.isArray(msg.payload?.elements)) {
      this.currentElements = msg.payload.elements;
      if (msg.payload.bgColor) this.currentBgColor = msg.payload.bgColor;
      if (msg.payload.gridType) this.currentGridType = msg.payload.gridType;
    } else if (msg.type === 'JOIN_ROOM') {
      // Send current state back to newly joined peer
      if (this.currentElements.length > 0) {
        this.broadcastElements(this.currentElements);
      }
    }

    // Forward to UI subscribers
    this.messageListeners.forEach((l) => l(msg));
  }

  private setConnectionStatus(status: ConnectionStatus) {
    if (this.connectionStatus === status) return;
    this.connectionStatus = status;
    const transportLabel =
      this.activeTransport === 'socket.io'
        ? 'Socket.io'
        : this.activeTransport === 'webrtc'
        ? 'P2P WebRTC'
        : '';
    this.statusChangeCallbacks.forEach((cb) => cb(status, transportLabel));
  }

  private syncCollaborators(list: Collaborator[]) {
    const now = Date.now();
    const activeRemoteIds = new Set<string>();

    list.forEach((c) => {
      if (c.id === this.localUser.id) return;
      activeRemoteIds.add(c.id);

      const existing = this.collaboratorsMap.get(c.id);
      this.collaboratorsMap.set(c.id, {
        id: c.id,
        name: c.name || 'Collaborator',
        color: c.color || '#6366f1',
        cursor: c.cursor ?? existing?.cursor,
        lastActive: now,
      });
    });

    this.collaboratorsMap.forEach((_, id) => {
      if (id !== this.localUser.id && !activeRemoteIds.has(id)) {
        this.collaboratorsMap.delete(id);
      }
    });

    this.notifyCollabChange();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public subscribe(listener: (msg: CollabMessage) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    };
  }

  public onCollaboratorsChange(callback: (list: Collaborator[]) => void): () => void {
    this.collabChangeCallbacks.push(callback);
    callback(Array.from(this.collaboratorsMap.values()));
    return () => {
      this.collabChangeCallbacks = this.collabChangeCallbacks.filter((c) => c !== callback);
    };
  }

  public onConnectionStatusChange(
    callback: (status: ConnectionStatus, transport?: string) => void
  ): () => void {
    this.statusChangeCallbacks.push(callback);
    const transportLabel =
      this.activeTransport === 'socket.io'
        ? 'Socket.io'
        : this.activeTransport === 'webrtc'
        ? 'P2P WebRTC'
        : '';
    callback(this.connectionStatus, transportLabel);
    return () => {
      this.statusChangeCallbacks = this.statusChangeCallbacks.filter((c) => c !== callback);
    };
  }

  /**
   * Broadcast canvas elements to all room collaborators.
   * Dispatches across Socket.io + WebRTC DataChannels + BroadcastChannel.
   */
  public broadcastElements(elements: CanvasElement[]) {
    this.currentElements = elements;

    const msg: CollabMessage = {
      type: 'ELEMENTS_UPDATE',
      senderId: this.localUser.id,
      senderName: this.localUser.name,
      senderColor: this.localUser.color,
      roomId: this.roomId,
      payload: { elements },
      timestamp: Date.now(),
    };

    // Layer 1: Same browser
    this.postToBroadcastChannel('ELEMENTS_UPDATE', { elements });

    // Layer 2: Socket.io
    if (this.socket && this.socket.connected) {
      this.socket.emit('elements-update', {
        roomId: this.roomId,
        elements,
        writerId: this.localUser.id,
        writerName: this.localUser.name,
        writerColor: this.localUser.color,
      });
    }

    // Layer 3: WebRTC DataChannels
    this.sendToWebRTCPeers(msg);
  }

  /**
   * Stream live cursor movement at 60fps (~16ms throttle).
   */
  public broadcastCursor(point: Point) {
    this.localUser.cursor = point;

    // Layer 1: BroadcastChannel
    this.postToBroadcastChannel('CURSOR_MOVE', { point });

    this.pendingCursorPoint = point;

    if (this.cursorThrottleTimer === null) {
      this.cursorThrottleTimer = window.setTimeout(() => {
        if (!this.pendingCursorPoint) {
          this.cursorThrottleTimer = null;
          return;
        }

        const p = this.pendingCursorPoint;

        // Layer 2: Socket.io
        if (this.socket && this.socket.connected) {
          this.socket.emit('cursor-move', {
            roomId: this.roomId,
            point: p,
            user: {
              id: this.localUser.id,
              name: this.localUser.name,
              color: this.localUser.color,
            },
          });
        }

        // Layer 3: WebRTC P2P DataChannels
        const msg: CollabMessage = {
          type: 'CURSOR_MOVE',
          senderId: this.localUser.id,
          senderName: this.localUser.name,
          senderColor: this.localUser.color,
          roomId: this.roomId,
          payload: { point: p },
          timestamp: Date.now(),
        };
        this.sendToWebRTCPeers(msg);

        this.cursorThrottleTimer = null;
      }, 16);
    }
  }

  public broadcastClearCanvas() {
    this.currentElements = [];
    const msg: CollabMessage = {
      type: 'CLEAR_CANVAS',
      senderId: this.localUser.id,
      senderName: this.localUser.name,
      senderColor: this.localUser.color,
      roomId: this.roomId,
      payload: {},
      timestamp: Date.now(),
    };

    this.postToBroadcastChannel('CLEAR_CANVAS', {});

    if (this.socket && this.socket.connected) {
      this.socket.emit('clear-canvas', {
        roomId: this.roomId,
        userId: this.localUser.id,
      });
    }

    this.sendToWebRTCPeers(msg);
  }

  public broadcastBgColor(bgColor: string) {
    this.currentBgColor = bgColor;
    const msg: CollabMessage = {
      type: 'CHANGE_BG_COLOR',
      senderId: this.localUser.id,
      senderName: this.localUser.name,
      senderColor: this.localUser.color,
      roomId: this.roomId,
      payload: { bgColor },
      timestamp: Date.now(),
    };

    this.postToBroadcastChannel('CHANGE_BG_COLOR', { bgColor });

    if (this.socket && this.socket.connected) {
      this.socket.emit('change-canvas-settings', {
        roomId: this.roomId,
        bgColor,
      });
    }

    this.sendToWebRTCPeers(msg);
  }

  public broadcastGridType(gridType: string) {
    this.currentGridType = gridType;
    const msg: CollabMessage = {
      type: 'CHANGE_GRID_TYPE',
      senderId: this.localUser.id,
      senderName: this.localUser.name,
      senderColor: this.localUser.color,
      roomId: this.roomId,
      payload: { gridType },
      timestamp: Date.now(),
    };

    this.postToBroadcastChannel('CHANGE_GRID_TYPE', { gridType });

    if (this.socket && this.socket.connected) {
      this.socket.emit('change-canvas-settings', {
        roomId: this.roomId,
        gridType,
      });
    }

    this.sendToWebRTCPeers(msg);
  }

  public updateLocalUserName(newName: string) {
    if (!newName.trim()) return;
    this.localUser.name = newName.trim();
    localStorage.setItem('scribble_collab_name', this.localUser.name);

    if (this.socket && this.socket.connected) {
      this.socket.emit('update-user-profile', {
        roomId: this.roomId,
        user: {
          id: this.localUser.id,
          name: this.localUser.name,
          color: this.localUser.color,
        },
      });
    }

    const msg: CollabMessage = {
      type: 'JOIN_ROOM',
      senderId: this.localUser.id,
      senderName: this.localUser.name,
      senderColor: this.localUser.color,
      roomId: this.roomId,
      payload: { user: this.localUser },
      timestamp: Date.now(),
    };

    this.postToBroadcastChannel('JOIN_ROOM', { user: this.localUser });
    this.sendToWebRTCPeers(msg);
  }

  public getShareableUrl(): string {
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.roomId);
    return url.toString();
  }

  // ─── Internal Dispatch Helpers ────────────────────────────────────────────

  private postToBroadcastChannel(type: CollabMessageType, payload: any) {
    if (!this.broadcastChannel) return;
    const msg: CollabMessage = {
      type,
      senderId: this.localUser.id,
      senderName: this.localUser.name,
      senderColor: this.localUser.color,
      roomId: this.roomId,
      payload,
      timestamp: Date.now(),
    };
    try {
      this.broadcastChannel.postMessage(msg);
    } catch {
      /* ignore */
    }
  }

  private sendToWebRTCPeers(msg: CollabMessage) {
    this.peerConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch {
          /* ignore */
        }
      }
    });
  }

  private notifyCollabChange() {
    const list = Array.from(this.collaboratorsMap.values());
    this.collabChangeCallbacks.forEach((cb) => cb(list));
  }
}
