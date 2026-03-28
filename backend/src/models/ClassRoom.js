import mongoose from "mongoose";

const classRoomSchema = new mongoose.Schema(
  {
    class: { type: Number, required: true },
    section: { type: String, required: true, enum: ["A", "B", "C"] },
    classTeacherId: { type: String, default: null },
    subjects: { type: [String], default: [] }
  },
  { timestamps: true }
);

classRoomSchema.index({ class: 1, section: 1 }, { unique: true });

export const ClassRoom = mongoose.model("ClassRoom", classRoomSchema);
