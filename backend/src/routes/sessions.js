const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const prisma = new PrismaClient();

// Generate a short invite code
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Create session (Mentor only)
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'MENTOR') {
      return res.status(403).json({ error: 'Only mentors can create sessions' });
    }

    const { title, description, language } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Session title is required' });
    }

    let inviteCode;
    let isUnique = false;
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const existing = await prisma.session.findUnique({ where: { inviteCode } });
      if (!existing) isUnique = true;
    }

    const session = await prisma.session.create({
      data: {
        title,
        description: description || null,
        language: language || 'javascript',
        inviteCode,
        mentorId: req.user.userId,
      },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({ session });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get all sessions for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    let sessions;
    if (role === 'MENTOR') {
      sessions = await prisma.session.findMany({
        where: { mentorId: userId },
        include: {
          mentor: { select: { id: true, name: true } },
          student: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      sessions = await prisma.session.findMany({
        where: { studentId: userId },
        include: {
          mentor: { select: { id: true, name: true } },
          student: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Join session via invite code (Student)
router.post('/join', async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const session = await prisma.session.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: {
        mentor: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found with this invite code' });
    }

    if (session.status === 'ENDED') {
      return res.status(400).json({ error: 'This session has ended' });
    }

    // Allow mentor to get session info too
    if (req.user.userId === session.mentorId) {
      return res.json({ session });
    }

    // If student joining
    if (session.studentId && session.studentId !== req.user.userId) {
      return res.status(400).json({ error: 'Session is already occupied' });
    }

    // Assign student if not already
    if (!session.studentId) {
      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { studentId: req.user.userId },
        include: {
          mentor: { select: { id: true, name: true } },
          student: { select: { id: true, name: true } },
        },
      });
      return res.json({ session: updated });
    }

    res.json({ session });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// Get single session
router.get('/:id', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true, email: true } },
        messages: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check access
    const userId = req.user.userId;
    if (session.mentorId !== userId && session.studentId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Start session (Mentor only)
router.patch('/:id/start', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.mentorId !== req.user.userId) return res.status(403).json({ error: 'Only mentor can start session' });

    const updated = await prisma.session.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });

    res.json({ session: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// End session (Mentor only)
router.patch('/:id/end', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.mentorId !== req.user.userId) return res.status(403).json({ error: 'Only mentor can end session' });

    const updated = await prisma.session.update({
      where: { id: req.params.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    res.json({ session: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Delete session (Mentor only)
router.delete('/:id', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.mentorId !== req.user.userId) return res.status(403).json({ error: 'Only mentor can delete session' });

    await prisma.session.delete({ where: { id: req.params.id } });

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = router;
