import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errors } from 'celebrate';
import { fileURLToPath } from 'node:url';
import { connectMongoDB } from './db/connectMongoDB.js';
import { logger } from './middleware/logger.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import notesRoutes from './routes/notesRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(logger);
app.use(
  cors({
    origin:
      process.env.CLIENT_ORIGIN ||
      process.env.FRONTEND_DOMAIN ||
      'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const publicPath = fileURLToPath(new URL('../public/', import.meta.url));
app.use('/assets', express.static(publicPath, { index: false }));
app.get('/reset-password', (_req, res) => {
  res.set({
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
  res.sendFile('reset-password.html', { root: publicPath });
});

app.use(authRoutes);
app.use(userRoutes);
app.use(notesRoutes);
app.use(notFoundHandler);
app.use(errors());
app.use(errorHandler);

try {
  await connectMongoDB();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} catch (error) {
  console.error(`Server startup failed: ${error.message}`);
  process.exit(1);
}
