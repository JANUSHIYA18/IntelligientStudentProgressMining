import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { ClassRoom } from "../models/ClassRoom.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { User } from "../models/User.js";
import { SystemSetting } from "../models/SystemSetting.js";
import { MarkEntryExtensionRequest } from "../models/MarkEntryExtensionRequest.js";
import { created, fail, ok } from "../utils/apiResponse.js";
import { createDownloadPayload, toCsv } from "../utils/download.js";

const DEFAULT_PASSWORD = "123456";
const DEFAULT_MARK_ENTRY_STARTS_AT = new Date("2026-03-09T09:00:00+05:30");
const DEFAULT_MARK_ENTRY_DEADLINE_AT = new Date("2026-03-10T10:30:00+05:30");
const adminReadCache = new Map();

const withAdminCache = async (key, ttlMs, loader) => {
  const now = Date.now();
  const existing = adminReadCache.get(key);
  if (existing && existing.expiresAt > now) return existing.value;
  const value = await loader();
  adminReadCache.set(key, { expiresAt: now + ttlMs, value });
  return value;
};

const clearAdminReadCache = () => adminReadCache.clear();

const toEmailLocalPart = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
const parseClassValue = (value) => {
  const text = String(value ?? "").trim();
  const matched = text.match(/\d+/);
  if (!matched) return null;
  const classNum = Number(matched[0]);
  if (!Number.isInteger(classNum) || classNum < 1 || classNum > 12) return null;
  return classNum;
};

const getOrCreateSettings = async () => {
  const existing = await SystemSetting.findOne();
  if (existing) return existing;
  return SystemSetting.create({
    schoolName: "ProgressIQ School",
    academicYear: "2025-2026",
    attendanceThreshold: 75,
    passThreshold: 40,
    reportTheme: "classic",
    supportEmail: "support@progressiq.in",
    googleSignInEnabled: true,
    activeExam: "Exam 1",
    markEntryStartsAt: DEFAULT_MARK_ENTRY_STARTS_AT,
    markEntryDeadlineAt: DEFAULT_MARK_ENTRY_DEADLINE_AT,
    updatedByName: "System"
  });
};

const getUniqueUsername = async (baseUsername) => {
  let candidate = baseUsername;
  let counter = 2;

  while (await User.exists({ username: candidate })) {
    const [localPart, domain] = baseUsername.split("@");
    candidate = `${localPart}${counter}@${domain}`;
    counter += 1;
  }

  return candidate;
};

export const getDashboard = async (req, res) => {
  try {
    const payload = await withAdminCache("dashboard", 20_000, async () => {
      const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
        Student.countDocuments(), Teacher.countDocuments(), ClassRoom.countDocuments()
      ]);

      const avg = await Student.aggregate([
        { $project: { avgMarks: { $cond: [{ $gt: [{ $size: "$subjects" }, 0] }, { $avg: "$subjects.marks" }, 0] } } },
        { $group: { _id: null, averagePerformance: { $avg: "$avgMarks" } } }
      ]);

      return {
        totalStudents,
        totalTeachers,
        totalClasses,
        averagePerformance: Number((avg[0]?.averagePerformance || 0).toFixed(2))
      };
    });
    return ok(res, payload);
  } catch (error) { return fail(res, 500, error.message); }
};

export const getPerformanceDistribution = async (req, res) => {
  try {
    const mapped = await withAdminCache("performance-distribution", 20_000, async () => {
      const result = await Student.aggregate([
        { $project: { avgMarks: { $cond: [{ $gt: [{ $size: "$subjects" }, 0] }, { $avg: "$subjects.marks" }, 0] } } },
        { $project: { bucket: { $switch: { branches: [
          { case: { $gte: ["$avgMarks", 75] }, then: "Good" },
          { case: { $and: [{ $gte: ["$avgMarks", 60] }, { $lt: ["$avgMarks", 75] }] }, then: "Average" }
        ], default: "Weak" } } } },
        { $group: { _id: "$bucket", value: { $sum: 1 } } }
      ]);
      return ["Good", "Average", "Weak"].map((name) => ({ name, value: result.find((r) => r._id === name)?.value || 0 }));
    });
    return ok(res, mapped);
  } catch (error) { return fail(res, 500, error.message); }
};

export const getClassPerformance = async (req, res) => {
  try {
    const payload = await withAdminCache("class-performance", 20_000, async () => {
      const rows = await Student.aggregate([
        { $project: { class: "$class", avgMarks: { $cond: [{ $gt: [{ $size: "$subjects" }, 0] }, { $avg: "$subjects.marks" }, 0] } } },
        { $project: { class: 1, status: { $switch: { branches: [
          { case: { $gte: ["$avgMarks", 75] }, then: "good" },
          { case: { $and: [{ $gte: ["$avgMarks", 60] }, { $lt: ["$avgMarks", 75] }] }, then: "average" }
        ], default: "weak" } } } },
        { $group: { _id: { class: "$class", status: "$status" }, count: { $sum: 1 } } }
      ]);

      const grouped = {};
      rows.forEach((row) => {
        const key = `Class ${row._id.class}`;
        if (!grouped[key]) grouped[key] = { class: key, good: 0, average: 0, weak: 0 };
        grouped[key][row._id.status] = row.count;
      });
      return Object.values(grouped);
    });
    return ok(res, payload);
  } catch (error) { return fail(res, 500, error.message); }
};

export const getActivities = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const items = await withAdminCache(`activities:${limit}`, 8_000, async () =>
      ActivityLog.find().sort({ createdAt: -1 }).limit(limit).lean()
    );
    return ok(res, items);
  } catch (error) { return fail(res, 500, error.message); }
};

export const addStudent = async (req, res) => {
  try {
    const p = req.body;
    const classNum = parseClassValue(p.class);
    const section = String(p.section || "").trim().toUpperCase();
    const name = String(p.name || "").trim();
    const studentId = String(p.studentId || "").trim();

    if (!studentId || !name || !classNum || !section) return fail(res, 400, "studentId, name, class and section are required");

    const existingStudent = await Student.findOne({ studentId });
    if (existingStudent) return fail(res, 409, "studentId already exists");

    const student = await Student.create({
      ...p,
      studentId,
      name,
      class: classNum,
      section
    });
    const baseUsername = `${toEmailLocalPart(student.name)}@student.in`;
    const username = await getUniqueUsername(baseUsername);

    await User.create({
      name: student.name,
      username,
      email: username,
      password: DEFAULT_PASSWORD,
      role: "Student",
      studentId: student.studentId,
      teacherId: null,
      isActive: true
    });

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Admin",
      role: req.user?.role || "Admin",
      type: "create",
      action: `Added student ${student.studentId}`,
      details: `${student.name} added to Class ${student.class}-${student.section}`,
      metadata: { studentId: student.studentId }
    });

    clearAdminReadCache();
    return created(res, student, "Student created");
  } catch (error) { return fail(res, 500, error.message); }
};

export const addTeacher = async (req, res) => {
  try {
    const p = req.body;
    const teacherId = String(p.teacherId || "").trim();
    const name = String(p.name || "").trim();
    const subject = String(p.subject || "").trim();

    if (!teacherId || !name || !subject) return fail(res, 400, "teacherId, name and subject are required");

    const normalizedAssignedClasses = Array.isArray(p.assignedClasses)
      ? p.assignedClasses
          .map((item) => ({
            class: parseClassValue(item?.class),
            section: String(item?.section || "").trim().toUpperCase()
          }))
          .filter((item) => item.class && item.section)
      : [];

    const existingTeacher = await Teacher.findOne({ teacherId });
    if (existingTeacher) return fail(res, 409, "teacherId already exists");

    const teacher = await Teacher.create({
      ...p,
      teacherId,
      name,
      subject,
      assignedClasses: normalizedAssignedClasses
    });
    const baseUsername = `${toEmailLocalPart(teacher.name)}@teacher.in`;
    const username = await getUniqueUsername(baseUsername);

    await User.create({
      name: teacher.name,
      username,
      email: username,
      password: DEFAULT_PASSWORD,
      role: "Faculty",
      teacherId: teacher.teacherId,
      studentId: null,
      isActive: true
    });

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Admin",
      role: req.user?.role || "Admin",
      type: "create",
      action: `Added teacher ${teacher.teacherId}`,
      details: `${teacher.name} (${teacher.subject}) added`,
      metadata: { teacherId: teacher.teacherId }
    });

    clearAdminReadCache();
    return created(res, teacher, "Teacher created");
  } catch (error) { return fail(res, 500, error.message); }
};

export const getStudents = async (req, res) => {
  try {
    const rows = await withAdminCache("students:list", 15_000, async () =>
      Student.find({}, "studentId name class section rollNo").sort({ class: 1, section: 1, rollNo: 1, createdAt: -1 }).lean()
    );
    return ok(res, rows);
  }
  catch (error) { return fail(res, 500, error.message); }
};

export const getTeachers = async (req, res) => {
  try {
    const rows = await withAdminCache("teachers:list", 15_000, async () =>
      Teacher.find({}, "teacherId name subject email phone assignedClasses").sort({ createdAt: -1 }).lean()
    );
    return ok(res, rows);
  }
  catch (error) { return fail(res, 500, error.message); }
};

export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return fail(res, 404, "Student not found");

    if (student?.studentId) {
      await User.deleteOne({ role: "Student", studentId: student.studentId });
    }

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Admin",
      role: req.user?.role || "Admin",
      type: "update",
      action: `Deleted student ${student.studentId}`,
      details: `${student.name} removed`,
      metadata: { studentId: student.studentId }
    });

    clearAdminReadCache();
    return ok(res, null, "Student deleted");
  }
  catch (error) { return fail(res, 500, error.message); }
};

export const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return fail(res, 404, "Teacher not found");

    if (teacher?.teacherId) {
      await User.deleteOne({ role: "Faculty", teacherId: teacher.teacherId });
    }

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Admin",
      role: req.user?.role || "Admin",
      type: "update",
      action: `Deleted teacher ${teacher.teacherId}`,
      details: `${teacher.name} removed`,
      metadata: { teacherId: teacher.teacherId }
    });

    clearAdminReadCache();
    return ok(res, null, "Teacher deleted");
  }
  catch (error) { return fail(res, 500, error.message); }
};

export const getClasses = async (req, res) => {
  try {
    const rows = await withAdminCache("classes:list", 20_000, async () =>
      ClassRoom.find({}, "class section classTeacherId subjects").sort({ class: 1, section: 1 }).lean()
    );
    return ok(res, rows);
  }
  catch (error) { return fail(res, 500, error.message); }
};

export const getSystemSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return ok(res, settings);
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const updates = {};

    if (req.body.schoolName !== undefined) updates.schoolName = String(req.body.schoolName || "").trim();
    if (req.body.academicYear !== undefined) updates.academicYear = String(req.body.academicYear || "").trim();
    if (req.body.supportEmail !== undefined) updates.supportEmail = String(req.body.supportEmail || "").trim().toLowerCase();
    if (req.body.reportTheme !== undefined) updates.reportTheme = String(req.body.reportTheme || "").trim();

    if (req.body.attendanceThreshold !== undefined) {
      const value = Number(req.body.attendanceThreshold);
      if (Number.isNaN(value) || value < 0 || value > 100) return fail(res, 400, "attendanceThreshold must be 0-100");
      updates.attendanceThreshold = value;
    }

    if (req.body.passThreshold !== undefined) {
      const value = Number(req.body.passThreshold);
      if (Number.isNaN(value) || value < 0 || value > 100) return fail(res, 400, "passThreshold must be 0-100");
      updates.passThreshold = value;
    }

    if (req.body.googleSignInEnabled !== undefined) {
      updates.googleSignInEnabled = Boolean(req.body.googleSignInEnabled);
    }

    if (req.body.activeExam !== undefined) {
      const examName = String(req.body.activeExam || "").trim();
      if (!examName) return fail(res, 400, "activeExam is required");
      updates.activeExam = examName;
    }

    if (req.body.markEntryStartsAt !== undefined) {
      const startAt = new Date(req.body.markEntryStartsAt);
      if (Number.isNaN(startAt.getTime())) return fail(res, 400, "markEntryStartsAt must be a valid date");
      updates.markEntryStartsAt = startAt;
    }

    if (req.body.markEntryDeadlineAt !== undefined) {
      const deadlineAt = new Date(req.body.markEntryDeadlineAt);
      if (Number.isNaN(deadlineAt.getTime())) return fail(res, 400, "markEntryDeadlineAt must be a valid date");
      updates.markEntryDeadlineAt = deadlineAt;
    }

    if (updates.markEntryStartsAt && updates.markEntryDeadlineAt && updates.markEntryDeadlineAt <= updates.markEntryStartsAt) {
      return fail(res, 400, "markEntryDeadlineAt must be after markEntryStartsAt");
    }

    updates.updatedByUserId = req.user?._id || null;
    updates.updatedByName = req.user?.name || "Admin";

    const updated = await SystemSetting.findByIdAndUpdate(settings._id, { $set: updates }, { new: true, runValidators: true });

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Admin",
      role: req.user?.role || "Admin",
      type: "update",
      action: "Updated system settings",
      details: "System settings updated by admin"
    });

    clearAdminReadCache();
    return ok(res, updated, "System settings updated");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const getExamWindow = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return ok(res, {
      activeExam: settings.activeExam || "Exam 1",
      markEntryStartsAt: settings.markEntryStartsAt,
      markEntryDeadlineAt: settings.markEntryDeadlineAt,
      serverNow: new Date(),
      isMarkEntryOpen: !settings.markEntryDeadlineAt || new Date(settings.markEntryDeadlineAt).getTime() > Date.now()
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const getExtensionRequests = async (req, res) => {
  try {
    const status = String(req.query.status || "").trim().toLowerCase();
    const query = {};
    if (["pending", "approved", "rejected"].includes(status)) query.status = status;
    const requests = await withAdminCache(`extension-requests:${status || "all"}`, 8_000, async () =>
      MarkEntryExtensionRequest.find(query).sort({ createdAt: -1 }).limit(200).lean()
    );
    return ok(res, requests);
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const reviewExtensionRequest = async (req, res) => {
  try {
    const request = await MarkEntryExtensionRequest.findById(req.params.requestId);
    if (!request) return fail(res, 404, "Extension request not found");
    if (request.status !== "pending") return fail(res, 400, `Request already ${request.status}`);

    const action = String(req.body.action || "").trim().toLowerCase();
    if (!["approve", "reject"].includes(action)) return fail(res, 400, "action must be approve or reject");

    const settings = await getOrCreateSettings();
    if (action === "approve") {
      let nextDeadline = null;
      if (req.body.markEntryDeadlineAt) {
        const parsed = new Date(req.body.markEntryDeadlineAt);
        if (Number.isNaN(parsed.getTime())) return fail(res, 400, "markEntryDeadlineAt must be valid");
        nextDeadline = parsed;
      } else {
        const extendHours = Number(req.body.extendHours);
        if (Number.isNaN(extendHours) || extendHours <= 0) return fail(res, 400, "extendHours must be a positive number");
        const baseTime = settings.markEntryDeadlineAt ? new Date(settings.markEntryDeadlineAt).getTime() : Date.now();
        nextDeadline = new Date(baseTime + (extendHours * 60 * 60 * 1000));
      }

      settings.markEntryDeadlineAt = nextDeadline;
      settings.updatedByUserId = req.user?._id || null;
      settings.updatedByName = req.user?.name || "Admin";
      await settings.save();
      request.status = "approved";
      request.reviewComment = String(req.body.reviewComment || "").trim();
    } else {
      request.status = "rejected";
      request.reviewComment = String(req.body.reviewComment || "").trim();
    }

    request.reviewedByUserId = req.user?._id || null;
    request.reviewedByName = req.user?.name || "Admin";
    request.reviewedAt = new Date();
    await request.save();

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Admin",
      role: req.user?.role || "Admin",
      type: "update",
      action: `${action === "approve" ? "Approved" : "Rejected"} mark-entry extension request`,
      details: `${request.teacherName} | ${request.exam}`,
      metadata: { requestId: request._id, status: request.status }
    });

    clearAdminReadCache();
    return ok(res, request, `Extension request ${request.status}`);
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const exportActivities = async (req, res) => {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit || 1000), 1), 5000);

    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(limit);

    let payload;
    if (format === "json") {
      const json = JSON.stringify(logs, null, 2);
      payload = createDownloadPayload({
        filename: `activity-logs-${new Date().toISOString().slice(0, 10)}.json`,
        mimeType: "application/json",
        buffer: Buffer.from(json, "utf8")
      });
    } else {
      const csv = toCsv(
        ["createdAt", "actorName", "role", "type", "action", "details"],
        logs.map((log) => [
          log.createdAt?.toISOString?.() || "",
          log.actorName || "",
          log.role || "",
          log.type || "",
          log.action || "",
          log.details || ""
        ])
      );
      payload = createDownloadPayload({
        filename: `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`,
        mimeType: "text/csv;charset=utf-8",
        buffer: Buffer.from(csv, "utf8")
      });
    }

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Admin",
      role: req.user?.role || "Admin",
      type: "download",
      action: "Exported activity logs",
      details: `Format: ${format.toUpperCase()}, Rows: ${logs.length}`
    });

    return ok(res, payload, "Activity export generated");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
