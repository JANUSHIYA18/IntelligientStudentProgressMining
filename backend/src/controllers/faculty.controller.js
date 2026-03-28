import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { Assignment } from "../models/Assignment.js";
import { Announcement } from "../models/Announcement.js";
import { AssignmentProgress } from "../models/AssignmentProgress.js";
import { ClassRoom } from "../models/ClassRoom.js";
import { SystemSetting } from "../models/SystemSetting.js";
import { MarkEntryExtensionRequest } from "../models/MarkEntryExtensionRequest.js";
import { ExamMarkStatus } from "../models/ExamMarkStatus.js";
import { fail, ok } from "../utils/apiResponse.js";

const normalizeSection = (value) => String(value || "").trim().toUpperCase();
const parseClassNum = (value) => Number(value);
const normalizeActorName = (req, providedName) =>
  String(providedName || req.user?.name || req.user?.username || "Faculty");
const DEFAULT_MARK_ENTRY_STARTS_AT = new Date("2026-03-09T09:00:00+05:30");
const DEFAULT_MARK_ENTRY_DEADLINE_AT = new Date("2026-03-10T10:30:00+05:30");
const facultyReadCache = new Map();

const withFacultyCache = async (key, ttlMs, loader) => {
  const now = Date.now();
  const hit = facultyReadCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await loader();
  facultyReadCache.set(key, { expiresAt: now + ttlMs, value });
  return value;
};

const clearFacultyReadCache = (prefixes = []) => {
  if (!prefixes.length) {
    facultyReadCache.clear();
    return;
  }
  for (const key of facultyReadCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      facultyReadCache.delete(key);
    }
  }
};

const upsertStudentSubjectMarks = (student, subject, marks, totalMarks = 100) => {
  const idx = student.subjects.findIndex((s) => s.name === subject);
  if (idx >= 0) {
    student.subjects[idx].marks = marks;
    student.subjects[idx].totalMarks = totalMarks;
  } else {
    student.subjects.push({ name: subject, marks, totalMarks });
  }
};

const validateClassSection = (classNum, section) =>
  Number.isInteger(classNum) && classNum >= 1 && classNum <= 12 && ["A", "B"].includes(section);

const parseCsvMarksRows = (csvData) => {
  const lines = String(csvData || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
  const studentIdIndex = headers.indexOf("studentid");
  const marksIndex = headers.indexOf("marks");
  const subjectIndex = headers.indexOf("subject");
  const totalMarksIndex = headers.indexOf("totalmarks");

  if (studentIdIndex < 0 || marksIndex < 0) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((item) => item.trim());
    return {
      studentId: cols[studentIdIndex],
      marks: Number(cols[marksIndex]),
      subject: subjectIndex >= 0 ? cols[subjectIndex] : undefined,
      totalMarks: totalMarksIndex >= 0 ? Number(cols[totalMarksIndex]) : undefined
    };
  });
};

const getOrCreateExamWindowSettings = async () => {
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

const ensureMarkEntryWindowOpen = async (req, res) => {
  if (req.user?.role === "Admin") return { isOpen: true, settings: await getOrCreateExamWindowSettings() };
  const settings = await getOrCreateExamWindowSettings();
  const deadline = settings.markEntryDeadlineAt ? new Date(settings.markEntryDeadlineAt) : null;
  const isOpen = !deadline || deadline.getTime() > Date.now();
  if (!isOpen) {
    fail(
      res,
      403,
      `Mark entry deadline closed for ${settings.activeExam || "current exam"}. Request extension to continue.`
    );
    return { isOpen: false, settings };
  }
  return { isOpen: true, settings };
};

const getFacultyAccess = async (req) => {
  if (req.user?.role === "Admin") {
    return { teacher: null, allowedKeys: null, assignedClasses: [] };
  }

  const teacherId = String(req.user?.teacherId || "").trim();
  if (!teacherId) return { error: "Faculty account mapping missing" };

  const teacherDoc = await Teacher.findOne({ teacherId })
    .select("teacherId name subject email phone experience homeClass homeSection assignedClasses")
    .lean();
  if (!teacherDoc) return { error: "Faculty mapping not found" };

  const assignedClasses = (teacherDoc.assignedClasses || [])
    .map((item) => ({ class: Number(item.class), section: normalizeSection(item.section) }))
    .filter((item) => validateClassSection(item.class, item.section));

  if (!assignedClasses.length) return { error: "No class mapping assigned to this faculty" };

  return {
    teacher: teacherDoc,
    assignedClasses,
    allowedKeys: new Set(assignedClasses.map((item) => `${item.class}-${item.section}`))
  };
};

const canAccessClassSection = (access, classNum, section) => {
  if (!access?.allowedKeys) return true;
  return access.allowedKeys.has(`${classNum}-${section}`);
};

const ensureFacultySubject = (req, res, access, subject) => {
  if (req.user?.role === "Admin") return true;
  const facultySubject = String(access?.teacher?.subject || "").trim();
  if (!facultySubject) {
    fail(res, 403, "Faculty subject mapping missing");
    return false;
  }
  if (String(subject || "").trim() !== facultySubject) {
    fail(res, 403, `Faculty can update only assigned subject: ${facultySubject}`);
    return false;
  }
  return true;
};

const ensureFacultyCanAccessClassSection = (req, res, access, classNum, section) => {
  if (!canAccessClassSection(access, classNum, section)) {
    fail(res, 403, `Faculty is not mapped to Class ${classNum}-${section}`);
    return false;
  }
  return true;
};

const parseTargetClassSections = (targets, fallbackClass, fallbackSection) => {
  const normalized = [];
  const pushTarget = (classNum, section) => {
    if (!validateClassSection(classNum, section)) return;
    const key = `${classNum}-${section}`;
    if (normalized.some((item) => `${item.class}-${item.section}` === key)) return;
    normalized.push({ class: classNum, section });
  };

  if (Array.isArray(targets)) {
    targets.forEach((item) => {
      const classNum = parseClassNum(item?.class);
      const section = normalizeSection(item?.section);
      pushTarget(classNum, section);
    });
  }

  pushTarget(fallbackClass, fallbackSection);
  return normalized;
};

const recomputeAssignmentStatsForStudents = async (studentIds) => {
  const uniqueIds = [...new Set((studentIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!uniqueIds.length) return;

  const stats = await AssignmentProgress.aggregate([
    { $match: { studentId: { $in: uniqueIds } } },
    {
      $group: {
        _id: "$studentId",
        assignmentsTotal: { $sum: 1 },
        assignmentsCompleted: {
          $sum: { $cond: [{ $eq: ["$status", "complete"] }, 1, 0] }
        }
      }
    }
  ]);

  const byId = new Map(stats.map((row) => [String(row._id), row]));
  await Promise.all(
    uniqueIds.map((studentId) => {
      const row = byId.get(studentId);
      return Student.updateOne(
        { studentId },
        {
          $set: {
            assignmentsTotal: Number(row?.assignmentsTotal || 0),
            assignmentsCompleted: Number(row?.assignmentsCompleted || 0)
          }
        }
      );
    })
  );
};

const syncAssignmentProgressForCreatedAssignments = async (assignments) => {
  if (!assignments?.length) return;
  const studentIds = new Set();
  const progressRows = [];

  for (const assignment of assignments) {
    const students = await Student.find({ class: assignment.class, section: assignment.section }).select("studentId").lean();
    students.forEach((student) => {
      studentIds.add(student.studentId);
      progressRows.push({
        assignmentId: assignment._id,
        studentId: student.studentId,
        status: "incomplete",
        updatedByUserId: assignment.createdByUserId || null,
        updatedByName: assignment.createdByName || "Faculty"
      });
    });
  }

  if (progressRows.length) {
    await AssignmentProgress.insertMany(progressRows, { ordered: false }).catch(() => null);
  }
  await recomputeAssignmentStatsForStudents([...studentIds]);
};

const cleanupExpiredAssignments = async (filter = {}) => {
  const expired = await Assignment.find({ ...filter, dueDate: { $lt: new Date() } }).select("_id class section").lean();
  if (!expired.length) return 0;

  const assignmentIds = expired.map((item) => item._id);
  await Assignment.deleteMany({ _id: { $in: assignmentIds } });
  await AssignmentProgress.deleteMany({ assignmentId: { $in: assignmentIds } });

  const classSectionPairs = [...new Set(expired.map((item) => `${item.class}-${item.section}`))].map((key) => {
    const [classPart, sectionPart] = key.split("-");
    return { class: Number(classPart), section: sectionPart };
  });
  const affectedStudents = await Student.find({ $or: classSectionPairs }).select("studentId").lean();
  await recomputeAssignmentStatsForStudents(affectedStudents.map((student) => student.studentId));
  return expired.length;
};

export const getMyClasses = async (req, res) => {
  try {
    const userKey = req.user?.role === "Admin" ? "admin" : String(req.user?.teacherId || "unknown");
    const cacheKey = `my-classes:${userKey}`;
    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);

    if (req.user?.role === "Admin") {
      const classes = await withFacultyCache(cacheKey, 30_000, async () =>
        Array.from({ length: 12 }, (_, idx) => idx + 1).flatMap((classNum) => ([
          { class: classNum, section: "A" },
          { class: classNum, section: "B" }
        ]))
      );
      return ok(res, { teacher: null, assignedClasses: classes });
    }

    const payload = await withFacultyCache(cacheKey, 30_000, async () => ({
      teacher: access.teacher,
      assignedClasses: access.assignedClasses
    }));
    return ok(res, payload);
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const getOverview = async (req, res) => {
  try {
    const classNum = parseClassNum(req.query.class);
    const section = normalizeSection(req.query.section);
    if (!classNum || !section) return fail(res, 400, "class and section query params are required");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, classNum, section)) return;

    const [classRoom, totalStudents] = await Promise.all([
      ClassRoom.findOne({ class: classNum, section }).lean(),
      Student.countDocuments({ class: classNum, section })
    ]);
    const teacher = classRoom?.classTeacherId
      ? await Teacher.findOne({ teacherId: classRoom.classTeacherId }).lean()
      : await Teacher.findOne({ homeClass: classNum, homeSection: section }).lean();

    return ok(res, { teacher, totalStudents, class: classNum, section });
  } catch (error) { return fail(res, 500, error.message); }
};

export const getExamWindow = async (req, res) => {
  try {
    const userKey = req.user?.role === "Admin" ? "admin" : String(req.user?.teacherId || "unknown");
    const cacheKey = `exam-window:${userKey}`;
    const payload = await withFacultyCache(cacheKey, 6_000, async () => {
      const settings = await getOrCreateExamWindowSettings();
      const deadline = settings.markEntryDeadlineAt ? new Date(settings.markEntryDeadlineAt) : null;
      const isMarkEntryOpen = !deadline || deadline.getTime() > Date.now();
      let pendingRequest = null;

      if (req.user?.role === "Faculty" && req.user?.teacherId) {
        pendingRequest = await MarkEntryExtensionRequest.findOne({
          teacherId: String(req.user.teacherId),
          exam: settings.activeExam,
          status: "pending"
        })
          .sort({ createdAt: -1 })
          .lean();
      }

      return {
        activeExam: settings.activeExam || "Exam 1",
        markEntryStartsAt: settings.markEntryStartsAt,
        markEntryDeadlineAt: settings.markEntryDeadlineAt,
        serverNow: new Date(),
        isMarkEntryOpen,
        pendingRequest
      };
    });
    return ok(res, payload);
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const requestMarkEntryExtension = async (req, res) => {
  try {
    if (req.user?.role !== "Faculty") return fail(res, 403, "Only faculty can request extension");
    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);

    const settings = await getOrCreateExamWindowSettings();
    const requestedUntil = new Date(req.body.requestedUntil);
    if (Number.isNaN(requestedUntil.getTime())) return fail(res, 400, "requestedUntil must be a valid date");

    const currentDeadline = settings.markEntryDeadlineAt ? new Date(settings.markEntryDeadlineAt) : new Date();
    if (requestedUntil <= currentDeadline) {
      return fail(res, 400, "requestedUntil must be later than current deadline");
    }

    const teacherId = String(access.teacher?.teacherId || req.user?.teacherId || "").trim();
    const teacherName = String(access.teacher?.name || req.user?.name || "Faculty");

    const existingPending = await MarkEntryExtensionRequest.findOne({
      teacherId,
      exam: settings.activeExam,
      status: "pending"
    });
    if (existingPending) return fail(res, 409, "An extension request is already pending for this exam");

    const request = await MarkEntryExtensionRequest.create({
      exam: settings.activeExam,
      teacherId,
      teacherName,
      requestedUntil,
      reason: String(req.body.reason || "").trim(),
      status: "pending"
    });

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: teacherName,
      role: req.user?.role || "Faculty",
      type: "create",
      action: "Requested mark-entry deadline extension",
      details: `${settings.activeExam} until ${requestedUntil.toISOString()}`,
      metadata: { requestId: request._id }
    });

    clearFacultyReadCache(["exam-window:"]);
    return ok(res, request, "Extension request submitted");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const getStudents = async (req, res) => {
  try {
    const classNum = parseClassNum(req.query.class);
    const section = normalizeSection(req.query.section);
    const view = String(req.query.view || "").trim().toLowerCase();

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);

    if (classNum && section && !ensureFacultyCanAccessClassSection(req, res, access, classNum, section)) return;

    const query = {};
    if (classNum) query.class = classNum;
    if (section) query.section = section;

    if (access.allowedKeys) {
      const allowedPairs = access.assignedClasses;
      if (classNum && section) {
        // already validated above
      } else {
        query.$or = allowedPairs.map((item) => ({ class: item.class, section: item.section }));
      }
    }

    let projection = null;
    if (view === "graph") projection = "studentId subjects";

    const userKey = req.user?.role === "Admin" ? "admin" : String(req.user?.teacherId || "unknown");
    const cacheKey = `students:${userKey}:${classNum || "all"}:${section || "all"}:${view || "default"}`;
    const students = await withFacultyCache(cacheKey, 12_000, async () =>
      Student.find(query, projection).sort({ rollNo: 1 }).lean()
    );
    return ok(res, students);
  } catch (error) { return fail(res, 500, error.message); }
};

export const getStudentDetails = async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId }).lean();
    if (!student) return fail(res, 404, "Student not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, student.class, student.section)) return;

    return ok(res, student);
  } catch (error) { return fail(res, 500, error.message); }
};

export const getMarkStatuses = async (req, res) => {
  try {
    const classNum = parseClassNum(req.query.class);
    const section = normalizeSection(req.query.section);
    const exam = String(req.query.exam || "").trim();
    const subject = String(req.query.subject || "").trim();
    if (!classNum || !section || !exam || !subject) {
      return fail(res, 400, "class, section, exam and subject query params are required");
    }

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, classNum, section)) return;
    if (!ensureFacultySubject(req, res, access, subject)) return;

    const rows = await ExamMarkStatus.find({ class: classNum, section, exam, subject })
      .select("studentId status")
      .lean();
    return ok(res, rows);
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const saveMarks = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subject, marks, totalMarks = 100 } = req.body;
    if (!subject || marks === undefined) return fail(res, 400, "subject and marks are required");
    const windowStatus = await ensureMarkEntryWindowOpen(req, res);
    if (!windowStatus.isOpen) return;

    const student = await Student.findOne({ studentId });
    if (!student) return fail(res, 404, "Student not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, student.class, student.section)) return;
    if (!ensureFacultySubject(req, res, access, subject)) return;

    const exam = String(req.body.exam || windowStatus.settings.activeExam || "").trim();
    const status = String(req.body.status || "present").trim().toLowerCase();
    if (exam) {
      if (!["present", "absent"].includes(status)) return fail(res, 400, "status must be present|absent");
      await ExamMarkStatus.findOneAndUpdate(
        { studentId: student.studentId, exam, subject },
        {
          $set: {
            class: student.class,
            section: student.section,
            status,
            updatedByUserId: req.user?._id || null,
            updatedByName: normalizeActorName(req, req.body.actorName)
          }
        },
        { upsert: true, new: true }
      );
      if (status === "absent") {
        return ok(res, student, "Student marked absent for exam");
      }
    }

    upsertStudentSubjectMarks(student, subject, Number(marks), Number(totalMarks));
    await student.save();

    const actorName = normalizeActorName(req, req.body.actorName);
    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName,
      role: req.user?.role || "Faculty",
      type: "update",
      action: `Updated marks for ${student.studentId}`,
      details: `${subject}: ${marks}/${totalMarks}`
    });

    clearFacultyReadCache(["students:", "exam-window:"]);
    return ok(res, student, "Marks saved");
  } catch (error) { return fail(res, 500, error.message); }
};

export const saveAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { presentDays, totalDays } = req.body;
    if (presentDays === undefined || totalDays === undefined) {
      return fail(res, 400, "presentDays and totalDays are required");
    }

    const student = await Student.findOne({ studentId });
    if (!student) return fail(res, 404, "Student not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, student.class, student.section)) return;

    student.presentDays = Number(presentDays);
    student.totalDays = Number(totalDays);
    await student.save();

    const actorName = normalizeActorName(req, req.body.actorName);
    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName,
      role: req.user?.role || "Faculty",
      type: "attendance",
      action: `Updated attendance for ${student.studentId}`,
      details: `${presentDays}/${totalDays}`
    });

    clearFacultyReadCache(["students:"]);
    return ok(res, student, "Attendance saved");
  } catch (error) { return fail(res, 500, error.message); }
};

export const saveMarksBulk = async (req, res) => {
  try {
    const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (!entries.length) return fail(res, 400, "entries array is required");
    const windowStatus = await ensureMarkEntryWindowOpen(req, res);
    if (!windowStatus.isOpen) return;
    const exam = String(req.body.exam || windowStatus.settings.activeExam || "").trim();
    if (!exam) return fail(res, 400, "exam is required");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);

    const actorName = normalizeActorName(req, req.body.actorName);
    const uniqueIds = [...new Set(entries.map((entry) => String(entry.studentId || "").trim()).filter(Boolean))];
    const students = await Student.find({ studentId: { $in: uniqueIds } });
    const byStudentId = new Map(students.map((student) => [student.studentId, student]));
    const invalidEntries = [];
    const missingStudentIds = new Set();
    const touchedStudentIds = new Set();
    const statusOps = [];

    entries.forEach((entry, index) => {
      const studentId = String(entry.studentId || "").trim();
      const subject = String(entry.subject || "").trim();
      const status = String(entry.status || "present").trim().toLowerCase();
      const hasMarks = entry.marks !== undefined && entry.marks !== null && String(entry.marks).trim() !== "";
      const marks = hasMarks ? Number(entry.marks) : null;
      const totalMarks = entry.totalMarks === undefined ? 100 : Number(entry.totalMarks);

      if (!studentId || !subject || !["present", "absent"].includes(status) || Number.isNaN(totalMarks) || totalMarks <= 0) {
        invalidEntries.push({ index, studentId, reason: "Invalid studentId/subject/status/totalMarks" });
        return;
      }

      const student = byStudentId.get(studentId);
      if (!student) {
        missingStudentIds.add(studentId);
        return;
      }

      if (!canAccessClassSection(access, student.class, student.section)) {
        invalidEntries.push({ index, studentId, reason: "Faculty not mapped to this student's class-section" });
        return;
      }
      if (req.user?.role !== "Admin") {
        const facultySubject = String(access?.teacher?.subject || "").trim();
        if (subject !== facultySubject) {
          invalidEntries.push({ index, studentId, reason: `Faculty can update only assigned subject: ${facultySubject}` });
          return;
        }
      }

      if (status === "present" && hasMarks) {
        if (marks === null || Number.isNaN(marks)) {
          invalidEntries.push({ index, studentId, reason: "marks must be numeric for present status" });
          return;
        }
        upsertStudentSubjectMarks(student, subject, marks, totalMarks);
        touchedStudentIds.add(studentId);
      } else if (status === "present" && !hasMarks) {
        invalidEntries.push({ index, studentId, reason: "marks are required unless student is absent" });
        return;
      }

      statusOps.push({
        updateOne: {
          filter: { studentId, exam, subject },
          update: {
            $set: {
              class: student.class,
              section: student.section,
              status,
              updatedByUserId: req.user?._id || null,
              updatedByName: actorName
            }
          },
          upsert: true
        }
      });
    });

    if (statusOps.length) {
      await ExamMarkStatus.bulkWrite(statusOps, { ordered: false });
    }
    await Promise.all([...touchedStudentIds].map((studentId) => byStudentId.get(studentId).save()));

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName,
      role: req.user?.role || "Faculty",
      type: "update",
      action: "Bulk marks update",
      details: `${touchedStudentIds.size} students updated`,
      metadata: {
        requestedCount: entries.length,
        updatedCount: touchedStudentIds.size,
        missingCount: missingStudentIds.size,
        invalidCount: invalidEntries.length
      }
    });

    clearFacultyReadCache(["students:", "exam-window:"]);
    return ok(
      res,
      {
        updatedCount: touchedStudentIds.size,
        missingStudentIds: [...missingStudentIds],
        invalidEntries
      },
      "Bulk marks processed"
    );
  } catch (error) { return fail(res, 500, error.message); }
};

export const saveAttendanceBulk = async (req, res) => {
  try {
    const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (!entries.length) return fail(res, 400, "entries array is required");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);

    const actorName = normalizeActorName(req, req.body.actorName);
    const uniqueIds = [...new Set(entries.map((entry) => String(entry.studentId || "").trim()).filter(Boolean))];
    const students = await Student.find({ studentId: { $in: uniqueIds } });
    const byStudentId = new Map(students.map((student) => [student.studentId, student]));
    const invalidEntries = [];
    const missingStudentIds = new Set();
    const touchedStudentIds = new Set();

    entries.forEach((entry, index) => {
      const studentId = String(entry.studentId || "").trim();
      if (!studentId) {
        invalidEntries.push({ index, studentId, reason: "studentId is required" });
        return;
      }

      const student = byStudentId.get(studentId);
      if (!student) {
        missingStudentIds.add(studentId);
        return;
      }

      if (!canAccessClassSection(access, student.class, student.section)) {
        invalidEntries.push({ index, studentId, reason: "Faculty not mapped to this student's class-section" });
        return;
      }

      if (entry.presentDays !== undefined && entry.totalDays !== undefined) {
        const presentDays = Number(entry.presentDays);
        const totalDays = Number(entry.totalDays);
        if (Number.isNaN(presentDays) || Number.isNaN(totalDays) || presentDays < 0 || totalDays < 0) {
          invalidEntries.push({ index, studentId, reason: "Invalid presentDays or totalDays" });
          return;
        }
        student.presentDays = presentDays;
        student.totalDays = totalDays;
      } else {
        const status = String(entry.status || "").toLowerCase();
        if (!["present", "absent", "late"].includes(status)) {
          invalidEntries.push({ index, studentId, reason: "status must be present|absent|late" });
          return;
        }
        student.totalDays += 1;
        if (status === "present" || status === "late") student.presentDays += 1;
      }

      touchedStudentIds.add(studentId);
    });

    await Promise.all([...touchedStudentIds].map((studentId) => byStudentId.get(studentId).save()));

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName,
      role: req.user?.role || "Faculty",
      type: "attendance",
      action: "Bulk attendance update",
      details: `${touchedStudentIds.size} students updated`,
      metadata: {
        requestedCount: entries.length,
        updatedCount: touchedStudentIds.size,
        missingCount: missingStudentIds.size,
        invalidCount: invalidEntries.length
      }
    });

    clearFacultyReadCache(["students:"]);
    return ok(
      res,
      {
        updatedCount: touchedStudentIds.size,
        missingStudentIds: [...missingStudentIds],
        invalidEntries
      },
      "Bulk attendance processed"
    );
  } catch (error) { return fail(res, 500, error.message); }
};

export const uploadCsvMarks = async (req, res) => {
  try {
    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);

    if (req.user?.role !== "Admin") {
      req.body.subject = String(access?.teacher?.subject || "").trim();
    }

    const bodyRows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const csvRows = bodyRows.length ? bodyRows : parseCsvMarksRows(req.body.csvData);
    if (!csvRows.length) return fail(res, 400, "Provide rows array or valid csvData with studentId,marks columns");

    const defaultSubject = String(req.body.subject || "").trim();
    const defaultTotalMarks = req.body.totalMarks === undefined ? 100 : Number(req.body.totalMarks);
    if (!defaultSubject) return fail(res, 400, "subject is required when CSV rows do not include subject column");

    req.body.entries = csvRows.map((row) => ({
      studentId: row.studentId,
      subject: row.subject || defaultSubject,
      marks: row.marks,
      totalMarks: row.totalMarks === undefined || Number.isNaN(row.totalMarks) ? defaultTotalMarks : row.totalMarks
    }));

    return saveMarksBulk(req, res);
  } catch (error) { return fail(res, 500, error.message); }
};

export const createAssignment = async (req, res) => {
  try {
    const classNum = parseClassNum(req.body.class);
    const section = normalizeSection(req.body.section);
    const title = String(req.body.title || "").trim();
    const subject = String(req.body.subject || "").trim();
    const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    const targets = parseTargetClassSections(req.body.targets, classNum, section);
    if (!targets.length) return fail(res, 400, "At least one valid target class-section is required");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultySubject(req, res, access, subject)) return;
    for (const target of targets) {
      if (!ensureFacultyCanAccessClassSection(req, res, access, target.class, target.section)) return;
    }

    if (!title || !subject || !dueDate || Number.isNaN(dueDate.getTime())) {
      return fail(res, 400, "title, subject and valid dueDate are required");
    }

    const createdByName = normalizeActorName(req, req.body.createdByName);
    const assignmentRows = targets.map((target) => ({
      class: target.class,
      section: target.section,
      title,
      description: String(req.body.description || "").trim(),
      subject,
      dueDate,
      createdByUserId: req.user?._id || null,
      createdByName,
      status: req.body.status === "closed" ? "closed" : "active"
    }));
    const assignments = await Assignment.insertMany(assignmentRows, { ordered: true });
    await syncAssignmentProgressForCreatedAssignments(assignments);

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: createdByName,
      role: req.user?.role || "Faculty",
      type: "create",
      action: `Created assignment for ${targets.length} class-section(s)`,
      details: `${title} (${subject})`,
      metadata: {
        assignmentIds: assignments.map((item) => item._id),
        targets: targets.map((item) => `${item.class}-${item.section}`)
      }
    });

    clearFacultyReadCache(["assignments:", "students:"]);
    return ok(
      res,
      { createdCount: assignments.length, targets, assignments },
      assignments.length > 1 ? "Assignments created" : "Assignment created"
    );
  } catch (error) { return fail(res, 500, error.message); }
};

export const getAssignments = async (req, res) => {
  try {
    const classNum = req.query.class ? parseClassNum(req.query.class) : null;
    const section = req.query.section ? normalizeSection(req.query.section) : null;

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);

    if (classNum && section && !ensureFacultyCanAccessClassSection(req, res, access, classNum, section)) return;

    const query = {};
    if (classNum) query.class = classNum;
    if (section) query.section = section;
    if (req.query.status) query.status = String(req.query.status);
    query.dueDate = { $gte: new Date() };

    if (access.allowedKeys && !(classNum && section)) {
      query.$or = access.assignedClasses.map((item) => ({ class: item.class, section: item.section }));
    }

    const userKey = req.user?.role === "Admin" ? "admin" : String(req.user?.teacherId || "unknown");
    const cacheKey = `assignments:${userKey}:${classNum || "all"}:${section || "all"}:${String(req.query.status || "all")}`;
    void cleanupExpiredAssignments(query).catch(() => null);
    const assignments = await withFacultyCache(cacheKey, 8_000, async () =>
      Assignment.find(query).sort({ dueDate: 1, createdAt: -1 }).lean()
    );
    return ok(res, assignments);
  } catch (error) { return fail(res, 500, error.message); }
};

export const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) return fail(res, 404, "Assignment not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, assignment.class, assignment.section)) return;
    if (!ensureFacultySubject(req, res, access, assignment.subject)) return;

    if (req.body.title !== undefined) assignment.title = String(req.body.title || "").trim();
    if (req.body.description !== undefined) assignment.description = String(req.body.description || "").trim();
    if (req.body.status !== undefined) assignment.status = req.body.status === "closed" ? "closed" : "active";
    if (req.body.dueDate !== undefined) {
      const dueDate = new Date(req.body.dueDate);
      if (Number.isNaN(dueDate.getTime())) return fail(res, 400, "dueDate must be a valid date");
      assignment.dueDate = dueDate;
    }

    if (!assignment.title || !assignment.subject || !assignment.dueDate) {
      return fail(res, 400, "title, subject and dueDate are required");
    }

    await assignment.save();
    clearFacultyReadCache(["assignments:"]);
    return ok(res, assignment, "Assignment updated");
  } catch (error) { return fail(res, 500, error.message); }
};

export const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) return fail(res, 404, "Assignment not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, assignment.class, assignment.section)) return;

    await Assignment.deleteOne({ _id: assignment._id });
    await AssignmentProgress.deleteMany({ assignmentId: assignment._id });

    const students = await Student.find({ class: assignment.class, section: assignment.section }).select("studentId").lean();
    await recomputeAssignmentStatsForStudents(students.map((student) => student.studentId));
    clearFacultyReadCache(["assignments:", "students:"]);
    return ok(res, { assignmentId: assignment._id }, "Assignment deleted");
  } catch (error) { return fail(res, 500, error.message); }
};

export const getAssignmentProgress = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId).lean();
    if (!assignment) return fail(res, 404, "Assignment not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, assignment.class, assignment.section)) return;

    const [students, progressRows] = await Promise.all([
      Student.find({ class: assignment.class, section: assignment.section }).sort({ rollNo: 1 }).select("studentId name rollNo").lean(),
      AssignmentProgress.find({ assignmentId: assignment._id }).select("studentId status").lean()
    ]);

    const byStudentId = new Map(progressRows.map((row) => [row.studentId, row.status]));
    const entries = students.map((student) => ({
      studentId: student.studentId,
      name: student.name,
      rollNo: student.rollNo || student.studentId,
      status: byStudentId.get(student.studentId) || "incomplete"
    }));

    return ok(res, { assignment, entries });
  } catch (error) { return fail(res, 500, error.message); }
};

export const saveAssignmentProgressBulk = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId).lean();
    if (!assignment) return fail(res, 404, "Assignment not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, assignment.class, assignment.section)) return;

    const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (!entries.length) return fail(res, 400, "entries array is required");

    const classStudents = await Student.find({ class: assignment.class, section: assignment.section }).select("studentId").lean();
    const allowedIds = new Set(classStudents.map((student) => student.studentId));
    const actorName = normalizeActorName(req, req.body.actorName);
    const ops = [];
    const touched = new Set();

    entries.forEach((entry) => {
      const studentId = String(entry.studentId || "").trim();
      const status = String(entry.status || "").trim().toLowerCase();
      if (!allowedIds.has(studentId)) return;
      if (!["complete", "incomplete"].includes(status)) return;
      touched.add(studentId);
      ops.push({
        updateOne: {
          filter: { assignmentId: assignment._id, studentId },
          update: {
            $set: {
              status,
              updatedByUserId: req.user?._id || null,
              updatedByName: actorName
            }
          },
          upsert: true
        }
      });
    });

    if (!ops.length) return fail(res, 400, "No valid progress updates found");
    await AssignmentProgress.bulkWrite(ops, { ordered: false });
    await recomputeAssignmentStatsForStudents([...touched]);
    clearFacultyReadCache(["students:"]);
    return ok(res, { updatedCount: ops.length }, "Assignment progress saved");
  } catch (error) { return fail(res, 500, error.message); }
};

export const createAnnouncement = async (req, res) => {
  try {
    const classNum = parseClassNum(req.body.class);
    const section = normalizeSection(req.body.section);
    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    const targets = parseTargetClassSections(req.body.targets, classNum, section);
    if (!targets.length) return fail(res, 400, "At least one valid target class-section is required");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    for (const target of targets) {
      if (!ensureFacultyCanAccessClassSection(req, res, access, target.class, target.section)) return;
    }

    if (!title || !message) return fail(res, 400, "title and message are required");

    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return fail(res, 400, "expiresAt must be a valid date");

    const createdByName = normalizeActorName(req, req.body.createdByName);
    const announcementRows = targets.map((target) => ({
      class: target.class,
      section: target.section,
      title,
      message,
      priority: ["low", "normal", "high"].includes(req.body.priority) ? req.body.priority : "normal",
      expiresAt,
      createdByUserId: req.user?._id || null,
      createdByName
    }));
    const announcements = await Announcement.insertMany(announcementRows, { ordered: true });

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: createdByName,
      role: req.user?.role || "Faculty",
      type: "create",
      action: `Created announcement for ${targets.length} class-section(s)`,
      details: title,
      metadata: {
        announcementIds: announcements.map((item) => item._id),
        targets: targets.map((item) => `${item.class}-${item.section}`)
      }
    });

    clearFacultyReadCache(["announcements:"]);
    return ok(
      res,
      { createdCount: announcements.length, targets, announcements },
      announcements.length > 1 ? "Announcements created" : "Announcement created"
    );
  } catch (error) { return fail(res, 500, error.message); }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.announcementId);
    if (!announcement) return fail(res, 404, "Announcement not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, announcement.class, announcement.section)) return;

    if (req.body.title !== undefined) announcement.title = String(req.body.title || "").trim();
    if (req.body.message !== undefined) announcement.message = String(req.body.message || "").trim();
    if (req.body.priority !== undefined) {
      announcement.priority = ["low", "normal", "high"].includes(req.body.priority) ? req.body.priority : "normal";
    }
    if (req.body.expiresAt !== undefined) {
      if (!req.body.expiresAt) announcement.expiresAt = null;
      else {
        const expiresAt = new Date(req.body.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) return fail(res, 400, "expiresAt must be a valid date");
        announcement.expiresAt = expiresAt;
      }
    }
    if (!announcement.title || !announcement.message) return fail(res, 400, "title and message are required");

    await announcement.save();
    clearFacultyReadCache(["announcements:"]);
    return ok(res, announcement, "Announcement updated");
  } catch (error) { return fail(res, 500, error.message); }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.announcementId);
    if (!announcement) return fail(res, 404, "Announcement not found");

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);
    if (!ensureFacultyCanAccessClassSection(req, res, access, announcement.class, announcement.section)) return;

    await Announcement.deleteOne({ _id: announcement._id });
    clearFacultyReadCache(["announcements:"]);
    return ok(res, { announcementId: announcement._id }, "Announcement deleted");
  } catch (error) { return fail(res, 500, error.message); }
};

export const getAnnouncements = async (req, res) => {
  try {
    const classNum = req.query.class ? parseClassNum(req.query.class) : null;
    const section = req.query.section ? normalizeSection(req.query.section) : null;
    const includeExpired = String(req.query.includeExpired || "false").toLowerCase() === "true";

    const access = await getFacultyAccess(req);
    if (access.error) return fail(res, 403, access.error);

    if (classNum && section && !ensureFacultyCanAccessClassSection(req, res, access, classNum, section)) return;

    const query = {};
    if (classNum) query.class = classNum;
    if (section) query.section = section;

    if (access.allowedKeys && !(classNum && section)) {
      query.$or = access.assignedClasses.map((item) => ({ class: item.class, section: item.section }));
    }

    if (!includeExpired) {
      query.$and = [
        ...(query.$and || []),
        { $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }] }
      ];
    }

    const userKey = req.user?.role === "Admin" ? "admin" : String(req.user?.teacherId || "unknown");
    const cacheKey = `announcements:${userKey}:${classNum || "all"}:${section || "all"}:${includeExpired ? "with-expired" : "active"}`;
    const announcements = await withFacultyCache(cacheKey, 8_000, async () =>
      Announcement.find(query).sort({ createdAt: -1 }).lean()
    );
    return ok(res, announcements);
  } catch (error) { return fail(res, 500, error.message); }
};

