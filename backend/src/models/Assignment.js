import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    class: { type: Number, required: true, min: 1, max: 12 },
    section: { type: String, required: true, enum: ["A", "B", "C"] },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    subject: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdByName: { type: String, default: "Faculty" },
    status: { type: String, enum: ["active", "closed"], default: "active" }
  },
  { timestamps: true }
);

assignmentSchema.index({ class: 1, section: 1, dueDate: 1 });
assignmentSchema.index({ class: 1, section: 1, status: 1, dueDate: 1, createdAt: -1 });

export const Assignment = mongoose.model("Assignment", assignmentSchema);
