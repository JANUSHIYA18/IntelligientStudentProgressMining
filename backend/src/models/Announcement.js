import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    class: { type: Number, required: true, min: 1, max: 12 },
    section: { type: String, required: true, enum: ["A", "B", "C"] },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    expiresAt: { type: Date, default: null },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdByName: { type: String, default: "Faculty" }
  },
  { timestamps: true }
);

announcementSchema.index({ class: 1, section: 1, createdAt: -1 });
announcementSchema.index({ class: 1, section: 1, expiresAt: 1, createdAt: -1 });

export const Announcement = mongoose.model("Announcement", announcementSchema);
