import mongoose from "mongoose";

const markEntryExtensionRequestSchema = new mongoose.Schema(
  {
    exam: { type: String, required: true, trim: true },
    teacherId: { type: String, required: true, trim: true },
    teacherName: { type: String, required: true, trim: true },
    requestedUntil: { type: Date, required: true },
    reason: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedByName: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

markEntryExtensionRequestSchema.index({ exam: 1, teacherId: 1, status: 1 });

export const MarkEntryExtensionRequest = mongoose.model("MarkEntryExtensionRequest", markEntryExtensionRequestSchema);

