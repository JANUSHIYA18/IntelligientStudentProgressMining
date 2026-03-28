import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, required: true },
    role: { type: String, enum: ["Admin", "Faculty", "Student", "System"], default: "System" },
    type: { type: String, enum: ["login", "update", "attendance", "report", "create", "download", "view"], required: true },
    action: { type: String, required: true },
    details: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
