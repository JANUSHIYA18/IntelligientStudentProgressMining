import mongoose from "mongoose";

const examMarkStatusSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, trim: true },
    class: { type: Number, required: true, min: 1, max: 12 },
    section: { type: String, required: true, enum: ["A", "B"] },
    exam: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    status: { type: String, enum: ["present", "absent"], default: "present" },
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, default: null }
  },
  { timestamps: true }
);

examMarkStatusSchema.index({ studentId: 1, exam: 1, subject: 1 }, { unique: true });
examMarkStatusSchema.index({ class: 1, section: 1, exam: 1, subject: 1 });

export const ExamMarkStatus = mongoose.model("ExamMarkStatus", examMarkStatusSchema);

