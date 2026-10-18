// Чотири параметри потрібні, щоб Express розпізнав middleware помилок.
export const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || (error.name === 'ValidationError' ? 400 : 500);

  res.status(status).json({ message: error.message });
};
