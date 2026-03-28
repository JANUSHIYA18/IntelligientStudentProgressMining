import mongoose from "mongoose";

const reportTeacherSchema = new mongoose.Schema(
  { teacherId: String, name: String, subject: String, classes: [String] },
  { _id: false }
);

const reportStudentSchema = new mongoose.Schema(
  { studentId: String, name: String, classSection: String, percentage: Number, attendance: Number, grade: String, rank: Number },
  { _id: false }
);

const examReportSchema = new mongoose.Schema(
  {
    exam: { type: String, required: true },
    year: { type: String, required: true },
    term: { type: String, required: true },
    dateRange: { type: String, required: true },
    teachersInCharge: { type: [reportTeacherSchema], default: [] },
    students: { type: [reportStudentSchema], default: [] },
    overallStats: {
      totalStudents: { type: Number, default: 0 },
      averagePercentage: { type: Number, default: 0 },
      averageAttendance: { type: Number, default: 0 },
      passPercentage: { type: Number, default: 0 },
      topPerformers: { type: Number, default: 0 },
      needsImprovement: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

examReportSchema.index({ exam: 1, year: 1 }, { unique: true });
examReportSchema.index({ "students.studentId": 1, createdAt: -1 });

export const ExamReport = mongoose.model("ExamReport", examReportSchema);
