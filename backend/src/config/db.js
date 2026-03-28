import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  const conn = await mongoose.connect(env.mongodbUri, { autoIndex: true });
  console.log(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};
