import { v2 as cloudinary } from 'cloudinary';

export const saveFileToCloudinary = (buffer, userId) => {
  return new Promise((resolve, reject) => {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
      process.env;

    if (
      !CLOUDINARY_CLOUD_NAME ||
      !CLOUDINARY_API_KEY ||
      !CLOUDINARY_API_SECRET
    ) {
      return reject(new Error('Cloudinary configuration is missing'));
    }

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        public_id: `avatars/${userId}`,
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );

    stream.on('error', reject);
    stream.end(buffer);
  });
};
