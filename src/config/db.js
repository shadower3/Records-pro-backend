import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/records_pro';

mongoose.connect(uri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('Mongo connection error:', err));
