import createHttpError from 'http-errors';
import { Note } from '../models/note.js';

export const getAllNotes = async (req, res) => {
  const { page, perPage, tag, search } = req.query;
  const filter = {};

  if (tag) {
    filter.tag = tag;
  }

  if (search) {
    // Шукаємо введений текст буквально, зокрема символи на кшталт + чи [.
    const searchPattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    filter.$or = [
      { title: { $regex: searchPattern, $options: 'i' } },
      { content: { $regex: searchPattern, $options: 'i' } },
    ];
  }

  const [notes, totalNotes] = await Promise.all([
    Note.find(filter)
      .sort({ _id: 1 })
      .skip((page - 1) * perPage)
      .limit(perPage),
    Note.countDocuments(filter),
  ]);

  res.status(200).json({
    page,
    perPage,
    totalNotes,
    totalPages: Math.ceil(totalNotes / perPage),
    notes,
  });
};

export const getNoteById = async (req, res) => {
  const note = await Note.findById(req.params.noteId);

  if (!note) {
    throw createHttpError(404, 'Note not found');
  }

  res.status(200).json(note);
};

export const createNote = async (req, res) => {
  const { title, content, tag } = req.body ?? {};
  const note = await Note.create({ title, content, tag });

  res.status(201).json(note);
};

export const updateNote = async (req, res) => {
  // Оновлюємо тільки передані поля моделі, зберігаючи решту нотатки.
  const updates = {};

  for (const field of ['title', 'content', 'tag']) {
    if (Object.hasOwn(req.body ?? {}, field)) {
      updates[field] = req.body[field];
    }
  }

  const note = await Note.findByIdAndUpdate(
    req.params.noteId,
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  );

  if (!note) {
    throw createHttpError(404, 'Note not found');
  }

  res.status(200).json(note);
};

export const deleteNote = async (req, res) => {
  const note = await Note.findByIdAndDelete(req.params.noteId);

  if (!note) {
    throw createHttpError(404, 'Note not found');
  }

  res.status(200).json(note);
};
