import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    teacherId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    experience: { type: Number, default: 0 },
    homeClass: { type: Number, default: null },
    homeSection: { type: String, enum: ["A", "B", "C"], default: null },
    assignedClasses: {
      type: [
        {
          class: { type: Number, required: true },
          section: { type: String, enum: ["A", "B", "C"], required: true }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

teacherSchema.index({ homeClass: 1, homeSection: 1 });
teacherSchema.index({ "assignedClasses.class": 1, "assignedClasses.section": 1 });

export const Teacher = mongoose.model("Teacher", teacherSchema);
