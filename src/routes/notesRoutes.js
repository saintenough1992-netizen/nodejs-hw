import { Router } from 'express';
import {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
} from '../controllers/notesController.js';

const notesRoutes = Router();

notesRoutes.get('/notes', getAllNotes);
notesRoutes.get('/notes/:noteId', getNoteById);
notesRoutes.post('/notes', createNote);
notesRoutes.patch('/notes/:noteId', updateNote);
notesRoutes.delete('/notes/:noteId', deleteNote);

export default notesRoutes;
