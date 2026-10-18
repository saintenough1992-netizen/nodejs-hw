import mongoose from 'mongoose';

export const connectMongoDB = async () => {
  try {
    const { MONGO_URL } = process.env;

    if (!MONGO_URL) {
      throw new Error('MONGO_URL environment variable is required');
    }

    await mongoose.connect(MONGO_URL);
    console.log('✅ MongoDB connection established successfully');
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};