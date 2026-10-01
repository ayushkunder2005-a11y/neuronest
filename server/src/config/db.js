import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

// Helper to connect to MongoDB using MONGO_URI from environment
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    // Rethrow so caller can handle or exit as appropriate
    throw err;
  }
};

export default connectDB;
