import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { upload } from '../middleware/multer.js';
import { updateUserAvatar } from '../controllers/userController.js';

const userRoutes = Router();

userRoutes.patch(
  '/users/me/avatar',
  authenticate,
  upload.single('avatar'),
  updateUserAvatar,
);

export default userRoutes;
