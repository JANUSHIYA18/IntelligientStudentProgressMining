import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { Recommendation } from "../models/Recommendation.js";
import { Assignment } from "../models/Assignment.js";
import { Announcement } from "../models/Announcement.js";
import { AssignmentProgress } from "../models/AssignmentProgress.js";
import { ExamReport } from "../models/ExamReport.js";
import { ClassRoom } from "../models/ClassRoom.js";
import { fail, ok } from "../utils/apiResponse.js";

const studentReadCache = new Map();
const cleanupThrottleByClassSection = new Map();

const withStudentCache = async (key, ttlMs, loader) => {
  const now = Date.now();
  const hit = studentReadCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await loader();
  studentReadCache.set(key, { expiresAt: now + ttlMs, value });
  return value;
};

const maybeCleanupExpiredAssignments = async (classNum, section) => {
  const key = `${classNum}-${section}`;
  const now = Date.now();
  const lastRun = cleanupThrottleByClassSection.get(key) || 0;
  if ((now - lastRun) < (10 * 60 * 1000)) return;
  cleanupThrottleByClassSection.set(key, now);

  const expiredAssignments = await Assignment.find({
    class: classNum,
    section,
    dueDate: { $lt: new Date() }
  }).select("_id").lean();
  if (!expiredAssignments.length) return;

  const assignmentIds = expiredAssignments.map((item) => item._id);
  await Assignment.deleteMany({ _id: { $in: assignmentIds } });
  await AssignmentProgress.deleteMany({ assignmentId: { $in: assignmentIds } });
};

export const getDashboard = async (req, res) => {
  try {
    const studentId = String(req.params.studentId || "").trim();
    const payload = await withStudentCache(`dashboard:${studentId}`, 8_000, async () => {
      const student = await Student.findOne({ studentId }).lean();
      if (!student) return null;

      void maybeCleanupExpiredAssignments(student.class, student.section).catch(() => null);

      const classRoom = await ClassRoom.findOne({ class: student.class, section: student.section }).lean();
      const classTeacher = classRoom?.classTeacherId
        ? await Teacher.findOne({ teacherId: classRoom.classTeacherId }).select("teacherId name subject email phone experience homeClass homeSection assignedClasses").lean()
        : await Teacher.findOne({ homeClass: student.class, homeSection: student.section }).select("teacherId name subject email phone experience homeClass homeSection assignedClasses").lean();

      const weakSubjects = student.subjects.filter((s) => s.marks < 60);

      const [assignmentsRaw, announcements] = await Promise.all([
        Assignment.find({ class: student.class, section: student.section, status: "active", dueDate: { $gte: new Date() } })
          .sort({ dueDate: 1, createdAt: -1 })
          .limit(10)
          .lean(),
        Announcement.find({
          class: student.class,
          section: student.section,
          $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }]
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
      ]);

      const progressRows = await AssignmentProgress.find({
        assignmentId: { $in: assignmentsRaw.map((item) => item._id) },
        studentId: student.studentId
      }).select("assignmentId status").lean();
      const progressByAssignment = new Map(progressRows.map((row) => [String(row.assignmentId), row.status]));
      const assignments = assignmentsRaw.map((assignment) => ({
        ...assignment,
        completionStatus: progressByAssignment.get(String(assignment._id)) || "incomplete"
      }));
      const assignmentsTotal = assignments.length;
      const assignmentsCompleted = assignments.filter((assignment) => assignment.completionStatus === "complete").length;
      if (student.assignmentsTotal !== assignmentsTotal || student.assignmentsCompleted !== assignmentsCompleted) {
        void Student.updateOne(
          { studentId: student.studentId },
          { $set: { assignmentsTotal, assignmentsCompleted } }
        ).catch(() => null);
      }

      const assignmentPending = assignments.filter((assignment) => assignment.completionStatus !== "complete").length;
      const reminderDate = new Date().toLocaleDateString("en-GB");
      const notifications = [
        {
          id: `daily-exam-${student.studentId}-${new Date().toISOString().slice(0, 10)}`,
          type: "exam",
          title: "Daily Exam Reminder",
          message: "Revise your core subjects today and complete one exam-style practice set.",
          dateLabel: reminderDate
        },
        {
          id: `daily-assignment-${student.studentId}-${new Date().toISOString().slice(0, 10)}`,
          type: "assignment",
          title: "Daily Assignment Reminder",
          message: assignmentPending > 0 ? `${assignmentPending} assignment(s) are still pending.` : "All assignments are marked complete.",
          dateLabel: reminderDate
        },
        {
          id: `daily-announcement-${student.studentId}-${new Date().toISOString().slice(0, 10)}`,
          type: "announcement",
          title: "Daily Announcement Reminder",
          message: announcements.length ? `${announcements.length} class announcement(s) available.` : "No new class announcements today.",
          dateLabel: reminderDate
        }
      ];

      return {
        student,
        classTeacher,
        weakSubjects,
        attendance: student.attendancePercentage,
        academicPercentage: student.averageMarks,
        drawbacksCount: student.drawbacks,
        feesPending: student.feesPending,
        assignments,
        announcements,
        notifications
      };
    });
    if (!payload) return fail(res, 404, "Student not found");
    return ok(res, payload);
  } catch (error) { return fail(res, 500, error.message); }
};

export const getRecommendations = async (req, res) => {
  try {
    const studentId = String(req.params.studentId || "").trim();
    const cached = studentReadCache.get(`recommendations:${studentId}`);
    if (cached && cached.expiresAt > Date.now()) return ok(res, cached.value);

    const student = await Student.findOne({ studentId }).lean();
    if (!student) return fail(res, 404, "Student not found");

    const persisted = await Recommendation.find({ studentId }).sort({ createdAt: -1 }).limit(3).lean();
    const reports = await ExamReport.find(
      { students: { $elemMatch: { studentId: student.studentId } } },
      { exam: 1, students: 1, createdAt: 1 }
    ).sort({ createdAt: 1 });

    const subjectRows = student.subjects.map((subject) => {
      const pct = subject.totalMarks ? (Number(subject.marks || 0) / Number(subject.totalMarks || 100)) * 100 : 0;
      return { subject: subject.name, percentage: Number(pct.toFixed(2)) };
    });
    const weakSubjects = [...subjectRows].filter((s) => s.percentage < 60).sort((a, b) => a.percentage - b.percentage);
    const moderateSubjects = [...subjectRows].filter((s) => s.percentage >= 60 && s.percentage < 75).sort((a, b) => a.percentage - b.percentage);
    const strongSubjects = [...subjectRows].filter((s) => s.percentage >= 85).sort((a, b) => b.percentage - a.percentage);

    const examSeries = reports
      .map((report) => {
        const row = (report.students || []).find((studentRow) => studentRow.studentId === student.studentId);
        if (!row) return null;
        return { exam: report.exam, percentage: Number(row.percentage || 0) };
      })
      .filter(Boolean);
    const trendDelta = examSeries.length >= 2 ? examSeries[examSeries.length - 1].percentage - examSeries[0].percentage : 0;

    const attendance = student.totalDays ? (student.presentDays / student.totalDays) * 100 : 0;
    const average = student.subjects.length
      ? student.subjects.reduce((sum, sub) => sum + Number(sub.marks || 0), 0) / student.subjects.length
      : 0;

    const generated = [];

    if (weakSubjects.length) {
      const topWeak = weakSubjects.slice(0, 2);
      generated.push({
        title: `High Priority: ${topWeak.map((s) => s.subject).join(" + ")}`,
        description: `Focus the next 14 days on ${topWeak.map((s) => s.subject).join(" and ")}. Daily plan: 25 min concept revision + 20 min problem practice + 10 min error-log review. Target improvement: +10% in the next exam.`,
        priority: "high",
        category: "academic"
      });
    }

    if (attendance < 85) {
      generated.push({
        title: "Attendance Recovery Plan",
        description: `Your attendance is ${attendance.toFixed(1)}%. Improve to 92%+ by avoiding unplanned leave and revising missed classes within 24 hours. Higher attendance directly improves exam consistency.`,
        priority: "high",
        category: "discipline"
      });
    }

    if (moderateSubjects.length) {
      generated.push({
        title: "Conversion Strategy (60% to 75%+)",
        description: `For ${moderateSubjects.slice(0, 3).map((s) => s.subject).join(", ")}, use 3-step weekly cycle: fundamentals recap, 2 timed worksheets, and 1 teacher feedback session. This converts average performance into strong grades quickly.`,
        priority: "medium",
        category: "academic"
      });
    }

    if (examSeries.length >= 2) {
      generated.push({
        title: "Exam Trend Intelligence",
        description: `Across ${examSeries.length} exams, your trend is ${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(1)}%. ${trendDelta >= 0 ? "Maintain momentum with weekly mock tests and revision checkpoints." : "Reverse the decline by prioritizing weak chapters and taking one mock test every weekend."}`,
        priority: trendDelta >= 0 ? "low" : "high",
        category: "exam-strategy"
      });
    } else {
      generated.push({
        title: "First Exam Readiness Plan",
        description: "No full exam trend yet. Build a weekly exam routine: chapter tests on Wednesday, mixed-topic test on Sunday, and corrective revision on Monday. This creates strong early momentum.",
        priority: "medium",
        category: "exam-strategy"
      });
    }

    if (strongSubjects.length) {
      generated.push({
        title: `Strength Leverage: ${strongSubjects[0].subject}`,
        description: `Use ${strongSubjects[0].subject} (${strongSubjects[0].percentage.toFixed(1)}%) as your confidence anchor. Teach one topic to a peer each week to reinforce mastery and improve overall recall.`,
        priority: "low",
        category: "growth"
      });
    }

    generated.push({
      title: "AI Weekly Action Plan",
      description: `Current profile: ${average.toFixed(1)}% academic average, ${attendance.toFixed(1)}% attendance, ${student.drawbacks || 0} drawback(s). Weekly target: +3% score lift through 5 study sessions, 2 revision tests, and 1 teacher doubt-clearing session.`,
      priority: average < 70 ? "high" : "medium",
      category: "ai-plan"
    });

    const merged = [
      ...generated.slice(0, 6).map((item, index) => ({ ...item, _id: `ai-${student.studentId}-${index + 1}` })),
      ...persisted
    ];

    studentReadCache.set(`recommendations:${studentId}`, { expiresAt: Date.now() + 15_000, value: merged });
    return ok(res, merged);
  }
  catch (error) { return fail(res, 500, error.message); }
};

export const getGraphs = async (req, res) => {
  try {
    const studentId = String(req.params.studentId || "").trim();
    const cached = studentReadCache.get(`graphs:${studentId}`);
    if (cached && cached.expiresAt > Date.now()) return ok(res, cached.value);

    const student = await Student.findOne({ studentId }).lean();
    if (!student) return fail(res, 404, "Student not found");

    const subjectWise = student.subjects.map((s) => ({ subject: s.name, marks: s.marks, totalMarks: s.totalMarks }));
    const reports = await ExamReport.aggregate([
      { $match: { students: { $elemMatch: { studentId: student.studentId } } } },
      { $sort: { createdAt: 1 } },
      {
        $project: {
          exam: 1,
          row: {
            $first: {
              $filter: {
                input: "$students",
                as: "row",
                cond: { $eq: ["$$row.studentId", student.studentId] }
              }
            }
          }
        }
      }
    ]);

    const examWise = reports
      .filter((report) => report?.row)
      .map((report) => ({
        exam: report.exam,
        average: Number(report.row?.percentage || 0)
      }));

    const payload = {
      examWise,
      subjectWise,
      attendance: {
        presentDays: student.presentDays,
        totalDays: student.totalDays,
        percentage: student.totalDays ? Math.round((student.presentDays / student.totalDays) * 100) : 0
      }
    };
    studentReadCache.set(`graphs:${studentId}`, { expiresAt: Date.now() + 20_000, value: payload });
    return ok(res, payload);
  } catch (error) { return fail(res, 500, error.message); }
};
