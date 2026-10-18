import { HttpError } from 'http-errors';

// Чотири параметри потрібні, щоб Express розпізнав middleware помилок.
export const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  res.status(500).json({ message: error.message });
};