import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db/client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback-secret';

router.post('/guest', (req: Request, res: Response) => {
  const { username } = req.body as { username?: string };
  if (!username || username.trim().length < 2) {
    res.status(400).json({ error: 'Username must be at least 2 characters' });
    return;
  }
  const guestId = `guest_${uuidv4()}`;
  const token = jwt.sign(
    { id: guestId, username: username.trim(), isGuest: true },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, user: { id: guestId, username: username.trim(), isGuest: true } });
});

router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };
  if (!username || !email || !password) {
    res.status(400).json({ error: 'username, email and password are required' });
    return;
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email: email.toLowerCase(), password: hashed },
    });
    const token = jwt.sign(
      { id: user.id, username: user.username, isGuest: false },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, isGuest: false },
    });
  } catch {
    res.status(409).json({ error: 'Username or email already taken' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, isGuest: false },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: { id: user.id, username: user.username, isGuest: false },
  });
});

export default router;
