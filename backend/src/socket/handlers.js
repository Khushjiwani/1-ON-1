const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Map: sessionId -> Set of socket IDs
const sessionRooms = new Map();

const setupSocketHandlers = (io) => {
  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user?.userId})`);

    // ─── JOIN SESSION ROOM ────────────────────────────────
    socket.on('join-session', async ({ sessionId }) => {
      try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            mentor: { select: { id: true, name: true } },
            student: { select: { id: true, name: true } },
          },
        });

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        const userId = socket.user.userId;
        if (session.mentorId !== userId && session.studentId !== userId) {
          socket.emit('error', { message: 'Not authorized for this session' });
          return;
        }

        socket.join(sessionId);
        socket.currentSession = sessionId;

        if (!sessionRooms.has(sessionId)) {
          sessionRooms.set(sessionId, new Set());
        }
        sessionRooms.get(sessionId).add(socket.id);

        // Notify others
        socket.to(sessionId).emit('user-joined', {
          userId,
          name: socket.user.email,
          role: socket.user.role,
        });

        // Send current code state to new joiner
        if (session.code) {
          socket.emit('code-sync', { code: session.code, language: session.language });
        }

        console.log(`User ${userId} joined session ${sessionId}`);
      } catch (error) {
        console.error('Join session error:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // ─── CODE EDITOR SYNC ─────────────────────────────────
    let codeUpdateTimeout = null;
    socket.on('code-change', ({ sessionId, code, language }) => {
      // Broadcast to others in the room immediately
      socket.to(sessionId).emit('code-update', { code, language, userId: socket.user.userId });

      // Debounce DB save (save every 2 seconds)
      if (codeUpdateTimeout) clearTimeout(codeUpdateTimeout);
      codeUpdateTimeout = setTimeout(async () => {
        try {
          await prisma.session.update({
            where: { id: sessionId },
            data: { code, language },
          });
        } catch (err) {
          console.error('Code save error:', err);
        }
      }, 2000);
    });

    // Language change
    socket.on('language-change', ({ sessionId, language }) => {
      socket.to(sessionId).emit('language-update', { language });
    });

    // ─── CHAT MESSAGES ────────────────────────────────────
    socket.on('send-message', async ({ sessionId, content }) => {
      try {
        if (!content || !content.trim()) return;

        const message = await prisma.message.create({
          data: {
            content: content.trim(),
            sessionId,
            userId: socket.user.userId,
            type: 'TEXT',
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        });

        // Broadcast to all in session (including sender)
        io.to(sessionId).emit('new-message', {
          id: message.id,
          content: message.content,
          type: message.type,
          user: message.user,
          createdAt: message.createdAt,
        });
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ─── WEBRTC SIGNALING ─────────────────────────────────
    socket.on('webrtc-offer', ({ sessionId, offer, targetUserId }) => {
      socket.to(sessionId).emit('webrtc-offer', {
        offer,
        fromUserId: socket.user.userId,
      });
    });

    socket.on('webrtc-answer', ({ sessionId, answer, targetUserId }) => {
      socket.to(sessionId).emit('webrtc-answer', {
        answer,
        fromUserId: socket.user.userId,
      });
    });

    socket.on('webrtc-ice-candidate', ({ sessionId, candidate }) => {
      socket.to(sessionId).emit('webrtc-ice-candidate', {
        candidate,
        fromUserId: socket.user.userId,
      });
    });

    // ─── SESSION STATUS ───────────────────────────────────
    socket.on('session-started', ({ sessionId }) => {
      io.to(sessionId).emit('session-status-changed', { status: 'ACTIVE' });
    });

    socket.on('session-ended', ({ sessionId }) => {
      io.to(sessionId).emit('session-status-changed', { status: 'ENDED' });
    });

    // ─── TYPING INDICATOR ─────────────────────────────────
    socket.on('typing-start', ({ sessionId }) => {
      socket.to(sessionId).emit('user-typing', { userId: socket.user.userId });
    });

    socket.on('typing-stop', ({ sessionId }) => {
      socket.to(sessionId).emit('user-stopped-typing', { userId: socket.user.userId });
    });

    // ─── DISCONNECT ───────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);

      if (socket.currentSession) {
        const room = sessionRooms.get(socket.currentSession);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) sessionRooms.delete(socket.currentSession);
        }

        socket.to(socket.currentSession).emit('user-left', {
          userId: socket.user?.userId,
          role: socket.user?.role,
        });
      }
    });
  });
};

module.exports = { setupSocketHandlers };
