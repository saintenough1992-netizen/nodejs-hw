import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import { saveFileToCloudinary } from '../utils/saveFileToCloudinary.js';

export const updateUserAvatar = async (req, res) => {
  if (!req.file) {
    throw createHttpError(400, 'No file');
  }

  const image = await saveFileToCloudinary(req.file.buffer, req.user._id);

  if (!image?.secure_url) {
    throw new Error('Cloudinary did not return an image URL');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { avatar: image.secure_url } },
    { returnDocument: 'after', runValidators: true },
  );

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  res.status(200).json({ url: user.avatar });
};
