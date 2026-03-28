import mongoose from "mongoose";

const DEFAULT_MARK_ENTRY_STARTS_AT = new Date("2026-03-09T09:00:00+05:30");
const DEFAULT_MARK_ENTRY_DEADLINE_AT = new Date("2026-03-10T10:30:00+05:30");

const systemSettingSchema = new mongoose.Schema(
  {
    schoolName: { type: String, default: "ProgressIQ School" },
    academicYear: { type: String, default: "2025-2026" },
    attendanceThreshold: { type: Number, default: 75, min: 0, max: 100 },
    passThreshold: { type: Number, default: 40, min: 0, max: 100 },
    reportTheme: { type: String, default: "classic", enum: ["classic", "modern", "minimal"] },
    supportEmail: { type: String, default: "support@progressiq.in" },
    googleSignInEnabled: { type: Boolean, default: true },
    activeExam: { type: String, default: "Exam 1" },
    markEntryStartsAt: { type: Date, default: () => new Date(DEFAULT_MARK_ENTRY_STARTS_AT) },
    markEntryDeadlineAt: { type: Date, default: () => new Date(DEFAULT_MARK_ENTRY_DEADLINE_AT) },
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, default: "System" }
  },
  { timestamps: true }
);

export const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);
