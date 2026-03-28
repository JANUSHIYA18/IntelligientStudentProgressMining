import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    marks: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 100 }
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    class: { type: Number, required: true },
    section: { type: String, required: true, enum: ["A", "B"] },
    rollNo: { type: String },
    dob: { type: String },
    bloodGroup: { type: String },
    parentName: { type: String },
    parentContact: { type: String },
    feesPending: { type: Number, default: 0 },
    drawbacks: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    totalDays: { type: Number, default: 0 },
    assignmentsCompleted: { type: Number, default: 0 },
    assignmentsTotal: { type: Number, default: 0 },
    actionRequired: { type: String, default: "Keep up the good work!" },
    subjects: { type: [subjectSchema], default: [] }
  },
  { timestamps: true }
);

studentSchema.index({ class: 1, section: 1, rollNo: 1 });
studentSchema.index({ class: 1, section: 1, name: 1 });

studentSchema.virtual("attendancePercentage").get(function attendancePercentage() {
  if (!this.totalDays) return 0;
  return Math.round((this.presentDays / this.totalDays) * 100);
});

studentSchema.virtual("averageMarks").get(function averageMarks() {
  if (!this.subjects.length) return 0;
  const total = this.subjects.reduce((sum, subject) => sum + subject.marks, 0);
  return Number((total / this.subjects.length).toFixed(2));
});

studentSchema.set("toJSON", { virtuals: true });

export const Student = mongoose.model("Student", studentSchema);
