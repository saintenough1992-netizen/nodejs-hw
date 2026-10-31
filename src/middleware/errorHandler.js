import { HttpError } from 'http-errors';
import { MulterError } from 'multer';

// Чотири параметри потрібні, щоб Express розпізнав middleware помилок.
export const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  if (error instanceof MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? 'File is too large. Maximum size is 2 MB'
        : error.message,
    });
  }

  res.status(500).json({ message: error.message });
};
