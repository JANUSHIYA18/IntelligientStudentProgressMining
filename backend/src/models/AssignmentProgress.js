import mongoose from "mongoose";

const assignmentProgressSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    status: {
      type: String,
      enum: ["complete", "incomplete"],
      default: "incomplete"
    },
    updatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    updatedByName: {
      type: String,
      default: "Faculty"
    }
  },
  { timestamps: true }
);

assignmentProgressSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export const AssignmentProgress = mongoose.model("AssignmentProgress", assignmentProgressSchema);
