import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e7, // 10MB to accommodate embedded sketches/images if needed
});

const PORT = process.env.PORT || 3001;

// In-memory room store
// Map<roomId, { elements: CanvasElement[], collaborators: Map<socketId, Collaborator>, bgColor: string, gridType: string, lastActivity: number }>
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      elements: [],
      collaborators: new Map(),
      bgColor: '#fdfbf7',
      gridType: 'dots',
      lastActivity: Date.now(),
    });
  }
  return rooms.get(roomId);
}

// Health check and root info endpoints
app.get('/health', (req, res) => {
  let totalCollaborators = 0;
  rooms.forEach((room) => {
    totalCollaborators += room.collaborators.size;
  });

  res.json({
    status: 'ok',
    service: 'ScribbleCraft Collaboration Server',
    uptime: process.uptime(),
    activeRooms: rooms.size,
    totalOnlineUsers: totalCollaborators,
    timestamp: Date.now(),
  });
});

app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: system-ui, sans-serif; padding: 40px; text-align: center; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <h1 style="color: #6366f1; margin-bottom: 8px;">🎨 ScribbleCraft Socket.io Server</h1>
      <p style="color: #94a3b8; max-width: 500px; line-height: 1.6;">
        Ultra-low latency real-time WebSocket collaboration engine powering ScribbleCraft whiteboard rooms.
      </p>
      <div style="margin-top: 24px; padding: 12px 24px; background: #1e293b; border-radius: 9999px; font-weight: 600; color: #10b981; border: 1px solid #334155;">
        ● Server Status: Operational on Port ${PORT}
      </div>
    </div>
  `);
});

// Socket.io Real-time Event Handling
io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUser = null;

  // 1. Join Room
  socket.on('join-room', ({ roomId, user, initialElements, bgColor, gridType }) => {
    if (!roomId) return;

    currentRoomId = roomId;
    currentUser = user || {
      id: `user_${Math.random().toString(36).substring(2, 9)}`,
      name: 'Guest User',
      color: '#6366f1',
    };

    socket.join(roomId);
    const room = getOrCreateRoom(roomId);
    room.lastActivity = Date.now();

    // If room is fresh/empty and joining client provided elements, seed the room
    if (room.elements.length === 0 && Array.isArray(initialElements) && initialElements.length > 0) {
      room.elements = initialElements;
      if (bgColor) room.bgColor = bgColor;
      if (gridType) room.gridType = gridType;
    }

    // Register user in room's active collaborators
    room.collaborators.set(socket.id, {
      ...currentUser,
      socketId: socket.id,
      lastActive: Date.now(),
    });

    const collaboratorsList = Array.from(room.collaborators.values());

    // Send canonical room state & collaborator list to the joining socket
    socket.emit('sync-state', {
      roomId,
      elements: room.elements,
      bgColor: room.bgColor,
      gridType: room.gridType,
      collaborators: collaboratorsList,
    });

    // Broadcast updated collaborators list to everyone in the room
    io.to(roomId).emit('collaborators-update', {
      roomId,
      collaborators: collaboratorsList,
    });

    // Notify peers that a new user joined
    socket.to(roomId).emit('user-joined', {
      roomId,
      user: currentUser,
    });
  });

  // 2. Real-time Canvas Elements Update
  socket.on('elements-update', ({ roomId, elements, writerId, writerName, writerColor }) => {
    if (!roomId || !Array.isArray(elements)) return;

    const room = getOrCreateRoom(roomId);
    room.elements = elements;
    room.lastActivity = Date.now();

    // Broadcast update to all other room participants
    socket.to(roomId).emit('elements-update', {
      roomId,
      elements,
      writerId: writerId || currentUser?.id,
      writerName: writerName || currentUser?.name,
      writerColor: writerColor || currentUser?.color,
      timestamp: Date.now(),
    });
  });

  // Live in-progress drawing preview (smooth stroke/shape streaming while dragging)
  socket.on('live-draw-preview', ({ roomId, element, user }) => {
    if (!roomId) return;
    socket.to(roomId).emit('live-draw-preview', {
      roomId,
      element,
      userId: user?.id || currentUser?.id,
      userName: user?.name || currentUser?.name,
      userColor: user?.color || currentUser?.color,
    });
  });

  // 3. High-Frequency Live Cursor Movement (60fps stream)
  socket.on('cursor-move', ({ roomId, point, user }) => {
    if (!roomId || !point) return;

    const room = rooms.get(roomId);
    if (room && room.collaborators.has(socket.id)) {
      const collab = room.collaborators.get(socket.id);
      collab.cursor = point;
      collab.lastActive = Date.now();
    }

    // Stream cursor directly to peers without writing to disk
    socket.to(roomId).emit('cursor-move', {
      roomId,
      socketId: socket.id,
      userId: user?.id || currentUser?.id,
      userName: user?.name || currentUser?.name,
      userColor: user?.color || currentUser?.color,
      point,
    });
  });

  // 4. Clear Canvas
  socket.on('clear-canvas', ({ roomId, userId }) => {
    if (!roomId) return;

    const room = getOrCreateRoom(roomId);
    room.elements = [];
    room.lastActivity = Date.now();

    socket.to(roomId).emit('clear-canvas', {
      roomId,
      userId: userId || currentUser?.id,
      timestamp: Date.now(),
    });
  });

  // 5. Canvas Settings (Background Color & Grid Type)
  socket.on('change-canvas-settings', ({ roomId, bgColor, gridType }) => {
    if (!roomId) return;

    const room = getOrCreateRoom(roomId);
    if (bgColor) room.bgColor = bgColor;
    if (gridType) room.gridType = gridType;
    room.lastActivity = Date.now();

    socket.to(roomId).emit('canvas-settings-changed', {
      roomId,
      bgColor: room.bgColor,
      gridType: room.gridType,
      timestamp: Date.now(),
    });
  });

  // 6. User Profile Update (Name / Color change)
  socket.on('update-user-profile', ({ roomId, user }) => {
    if (!roomId || !user) return;

    currentUser = { ...currentUser, ...user };
    const room = rooms.get(roomId);
    if (room && room.collaborators.has(socket.id)) {
      room.collaborators.set(socket.id, {
        ...room.collaborators.get(socket.id),
        ...user,
      });

      io.to(roomId).emit('collaborators-update', {
        roomId,
        collaborators: Array.from(room.collaborators.values()),
      });
    }
  });

  // 7. Handle Disconnect / Leave
  const handleLeave = () => {
    if (!currentRoomId) return;

    const room = rooms.get(currentRoomId);
    if (room) {
      room.collaborators.delete(socket.id);
      const remainingCollaborators = Array.from(room.collaborators.values());

      io.to(currentRoomId).emit('collaborators-update', {
        roomId: currentRoomId,
        collaborators: remainingCollaborators,
      });

      socket.to(currentRoomId).emit('user-left', {
        roomId: currentRoomId,
        socketId: socket.id,
        user: currentUser,
      });

      // Cleanup room if empty for more than 2 hours to conserve memory
      if (remainingCollaborators.length === 0) {
        room.lastActivity = Date.now();
      }
    }
  };

  socket.on('leave-room', handleLeave);
  socket.on('disconnect', handleLeave);
});

// Periodic memory cleanup for stale inactive rooms (inactive > 4 hours)
setInterval(() => {
  const now = Date.now();
  const FOUR_HOURS = 4 * 60 * 60 * 1000;

  rooms.forEach((room, roomId) => {
    if (room.collaborators.size === 0 && now - room.lastActivity > FOUR_HOURS) {
      rooms.delete(roomId);
    }
  });
}, 30 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`🚀 ScribbleCraft Socket.io Collaboration Server running at http://localhost:${PORT}`);
});
