import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(pinoHttp());
app.use(cors());
app.use(express.json());

app.get('/notes', (_req, res) => {
  res.status(200).json({ message: 'Retrieved all notes' });
});

app.get('/notes/:noteId', (req, res) => {
  const { noteId } = req.params;

  res.status(200).json({ message: `Retrieved note with ID: ${noteId}` });
});

app.get('/test-error', () => {
  throw new Error('Simulated server error');
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Express розпізнає middleware помилок за чотирма параметрами.
app.use((err, _req, res, _next) => {
  res.status(500).json({ message: err.message });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
