import createHttpError from 'http-errors';
import { Session } from '../models/session.js';
import { User } from '../models/user.js';

export const authenticate = async (req, _res, next) => {
  const { accessToken } = req.cookies ?? {};

  if (!accessToken) {
    throw createHttpError(401, 'Missing access token');
  }

  if (typeof accessToken !== 'string') {
    throw createHttpError(401, 'Session not found');
  }

  const session = await Session.findOne({ accessToken });

  if (!session) {
    throw createHttpError(401, 'Session not found');
  }

  if (session.accessTokenValidUntil.getTime() <= Date.now()) {
    throw createHttpError(401, 'Access token expired');
  }

  const user = await User.findById(session.userId);

  if (!user) {
    throw createHttpError(401);
  }

  req.user = user;
  next();
};
