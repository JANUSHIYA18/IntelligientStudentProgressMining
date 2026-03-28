import mongoose from "mongoose";

const recommendationSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    category: { type: String, default: "academic" }
  },
  { timestamps: true }
);

export const Recommendation = mongoose.model("Recommendation", recommendationSchema);
