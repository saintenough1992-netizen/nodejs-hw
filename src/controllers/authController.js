import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';
import createHttpError from 'http-errors';
import { isValidObjectId } from 'mongoose';
import { User } from '../models/user.js';
import { Session } from '../models/session.js';
import { sendEmail } from '../utils/sendMail.js';
import {
  createSession,
  setSessionCookies,
  SESSION_COOKIE_OPTIONS,
} from '../services/auth.js';

export const registerUser = async (req, res) => {
  const { email, password } = req.body;

  if (await User.exists({ email })) {
    throw createHttpError(400, 'Email in use');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  let user;

  try {
    user = await User.create({ email, password: hashedPassword });
  } catch (error) {
    // Унікальний індекс також захищає від одночасної реєстрації одного email.
    if (error.code === 11000) {
      throw createHttpError(400, 'Email in use');
    }

    throw error;
  }

  const session = await createSession(user._id);
  setSessionCookies(res, session);

  res.status(201).json(user);
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw createHttpError(401, 'Invalid credentials');
  }

  await Session.deleteMany({ userId: user._id });
  const session = await createSession(user._id);
  setSessionCookies(res, session);

  res.status(200).json(user);
};

export const refreshUserSession = async (req, res) => {
  const { sessionId, refreshToken } = req.cookies ?? {};

  if (
    typeof sessionId !== 'string' ||
    !isValidObjectId(sessionId) ||
    typeof refreshToken !== 'string' ||
    !refreshToken
  ) {
    throw createHttpError(401, 'Session not found');
  }

  const session = await Session.findOne({ _id: sessionId, refreshToken });

  if (!session) {
    throw createHttpError(401, 'Session not found');
  }

  if (session.refreshTokenValidUntil.getTime() <= Date.now()) {
    await Session.deleteOne({ _id: session._id });
    res.clearCookie('sessionId', SESSION_COOKIE_OPTIONS);
    res.clearCookie('accessToken', SESSION_COOKIE_OPTIONS);
    res.clearCookie('refreshToken', SESSION_COOKIE_OPTIONS);

    throw createHttpError(401, 'Session token expired');
  }

  const { deletedCount } = await Session.deleteOne({
    _id: session._id,
    refreshToken,
  });

  // Лише один запит може використати стару сесію для ротації токенів.
  if (deletedCount === 0) {
    throw createHttpError(401, 'Session not found');
  }

  const newSession = await createSession(session.userId);
  setSessionCookies(res, newSession);

  res.status(200).json({ message: 'Session refreshed' });
};

export const logoutUser = async (req, res) => {
  const { sessionId } = req.cookies ?? {};

  if (typeof sessionId === 'string' && isValidObjectId(sessionId)) {
    await Session.deleteOne({ _id: sessionId });
  }

  res.clearCookie('sessionId', SESSION_COOKIE_OPTIONS);
  res.clearCookie('accessToken', SESSION_COOKIE_OPTIONS);
  res.clearCookie('refreshToken', SESSION_COOKIE_OPTIONS);

  res.status(204).end();
};

export const requestResetEmail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  const message = 'Password reset email sent successfully';

  // Однакова відповідь не розкриває, чи зареєстрований email.
  if (!user) {
    return res.status(200).json({ message });
  }

  try {
    const { JWT_SECRET, FRONTEND_DOMAIN } = process.env;

    if (!JWT_SECRET || !FRONTEND_DOMAIN) {
      throw new Error('Password reset configuration is missing');
    }

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' },
    );
    const resetUrl = new URL('/reset-password', FRONTEND_DOMAIN);

    if (!['http:', 'https:'].includes(resetUrl.protocol)) {
      throw new Error('FRONTEND_DOMAIN must be an HTTP or HTTPS address');
    }

    resetUrl.searchParams.set('token', token);
    const template = await readFile(
      new URL('../templates/reset-password-email.html', import.meta.url),
      'utf8',
    );
    const html = Handlebars.compile(template)({
      username: user.username || user.email,
      resetLink: resetUrl.href,
    });

    await sendEmail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'NoteHub — скидання пароля',
      html,
      text: `Вітаємо, ${user.username || user.email}! Щоб змінити пароль NoteHub, відкрийте ${resetUrl.href}. Посилання діє 15 хвилин. Якщо ви не надсилали цей запит, проігноруйте лист.`,
    });
  } catch {
    throw createHttpError(
      500,
      'Failed to send the email, please try again later.',
    );
  }

  res.status(200).json({ message });
};

export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  const { JWT_SECRET } = process.env;

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  let payload;

  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !isValidObjectId(payload.sub) ||
      typeof payload.email !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new Error('Invalid reset token payload');
    }
  } catch {
    throw createHttpError(401, 'Invalid or expired token');
  }

  const user = await User.findOne({ _id: payload.sub, email: payload.email });

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();
  await Session.deleteMany({ userId: user._id });
  res.clearCookie('sessionId', SESSION_COOKIE_OPTIONS);
  res.clearCookie('accessToken', SESSION_COOKIE_OPTIONS);
  res.clearCookie('refreshToken', SESSION_COOKIE_OPTIONS);

  res.status(200).json({ message: 'Password reset successfully' });
};
