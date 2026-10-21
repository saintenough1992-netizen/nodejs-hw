import bcrypt from 'bcrypt';
import createHttpError from 'http-errors';
import { isValidObjectId } from 'mongoose';
import { User } from '../models/user.js';
import { Session } from '../models/session.js';
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
