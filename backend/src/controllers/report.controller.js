import { ExamReport } from "../models/ExamReport.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { fail, ok } from "../utils/apiResponse.js";
import { buildAdminOverallReportPdf, buildClassReportCardPdf, buildSimplePdf, buildStudentReportCardPdf, createDownloadPayload, toCsv } from "../utils/download.js";

const buildAdminFallbackReport = async () => {
  const students = await Student.find();
  if (!students.length) return null;

  const mapped = students.map((student) => {
    const average = student.subjects?.length
      ? student.subjects.reduce((sum, sub) => sum + Number(sub.marks || 0), 0) / student.subjects.length
      : 0;
    const attendance = student.totalDays ? (student.presentDays / student.totalDays) * 100 : 0;
    return {
      studentId: student.studentId,
      name: student.name,
      classSection: `${student.class}-${student.section}`,
      percentage: Number(average.toFixed(2)),
      attendance: Number(attendance.toFixed(2)),
      grade: average >= 90 ? "A+" : average >= 75 ? "A" : average >= 60 ? "B" : average >= 40 ? "C" : "D",
      rank: 0
    };
  });

  const ranked = [...mapped]
    .sort((a, b) => b.percentage - a.percentage)
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  const averagePercentage = ranked.reduce((sum, row) => sum + row.percentage, 0) / ranked.length;
  const averageAttendance = ranked.reduce((sum, row) => sum + row.attendance, 0) / ranked.length;
  const teachers = await Teacher.find().select("teacherId name subject assignedClasses").limit(8);
  const teachersInCharge = teachers.map((teacher) => ({
    teacherId: teacher.teacherId,
    name: teacher.name,
    subject: teacher.subject,
    classes: (teacher.assignedClasses || []).map((c) => `${c.class}-${c.section}`)
  }));

  return {
    _id: "overall-institutional-snapshot",
    exam: "Overall Institutional Snapshot",
    year: String(new Date().getFullYear()),
    term: "Current",
    dateRange: "Live Academic Data Snapshot",
    teachersInCharge,
    students: ranked,
    overallStats: {
      totalStudents: ranked.length,
      averagePercentage: Number(averagePercentage.toFixed(2)),
      averageAttendance: Number(averageAttendance.toFixed(2)),
      passPercentage: Number(((ranked.filter((row) => row.percentage >= 40).length / ranked.length) * 100).toFixed(2)),
      topPerformers: ranked.filter((row) => row.percentage >= 90).length,
      needsImprovement: ranked.filter((row) => row.percentage < 60).length
    }
  };
};

export const getExamReports = async (req, res) => {
  try {
    let reports;
    if (req.user?.role === "Student" && req.user?.studentId) {
      reports = await ExamReport.find({ students: { $elemMatch: { studentId: req.user.studentId } } }).sort({ createdAt: -1 });
      reports = reports.map((report) => {
        const studentRow = (report.students || []).find((row) => row.studentId === req.user.studentId) || null;
        return {
          ...report.toObject(),
          students: studentRow ? [studentRow] : [],
          studentStats: studentRow
            ? {
                percentage: Number(studentRow.percentage || 0),
                attendance: Number(studentRow.attendance || 0),
                grade: studentRow.grade || "-"
              }
            : null
        };
      });
      if (!reports.length) {
        const student = await Student.findOne({ studentId: req.user.studentId });
        if (student) {
          const avg = student.subjects?.length
            ? student.subjects.reduce((sum, sub) => sum + Number(sub.marks || 0), 0) / student.subjects.length
            : 0;
          const attendance = student.totalDays ? (student.presentDays / student.totalDays) * 100 : 0;
          const grade = avg >= 90 ? "A+" : avg >= 80 ? "A" : avg >= 70 ? "B+" : avg >= 60 ? "B" : avg >= 50 ? "C" : avg >= 40 ? "D" : "F";

          reports = [
            {
              _id: `current-${student.studentId}`,
              exam: "Current Assessment",
              year: String(new Date().getFullYear()),
              term: "Current",
              dateRange: "Latest Academic Snapshot",
              teachersInCharge: [],
              students: [
                {
                  studentId: student.studentId,
                  name: student.name,
                  classSection: `${student.class}-${student.section}`,
                  percentage: Number(avg.toFixed(2)),
                  attendance: Number(attendance.toFixed(2)),
                  grade,
                  rank: 1
                }
              ],
              overallStats: {
                totalStudents: 1,
                averagePercentage: Number(avg.toFixed(2)),
                averageAttendance: Number(attendance.toFixed(2)),
                passPercentage: avg >= 40 ? 100 : 0,
                topPerformers: avg >= 90 ? 1 : 0,
                needsImprovement: avg < 60 ? 1 : 0
              },
              studentStats: {
                percentage: Number(avg.toFixed(2)),
                attendance: Number(attendance.toFixed(2)),
                grade
              }
            }
          ];
        }
      }
    } else {
      reports = await ExamReport.find().sort({ createdAt: -1 });
      if (!reports.length && req.user?.role === "Admin") {
        const fallback = await buildAdminFallbackReport();
        reports = fallback ? [fallback] : [];
      }
    }

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Unknown User",
      role: req.user?.role || "System",
      type: "view",
      action: "Viewed exam reports list",
      details: `${reports.length} reports fetched`
    });

    return ok(res, reports);
  }
  catch (error) { return fail(res, 500, error.message); }
};

export const getExamReportById = async (req, res) => {
  try {
    const report = await ExamReport.findById(req.params.id);
    if (!report) return fail(res, 404, "Exam report not found");

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Unknown User",
      role: req.user?.role || "System",
      type: "report",
      action: `Viewed report ${report.exam}`,
      details: `Report id: ${report._id}`
    });

    return ok(res, report);
  } catch (error) { return fail(res, 500, error.message); }
};

export const downloadReport = async (req, res) => {
  try {
    const format = String(req.query.format || "pdf").toLowerCase();
    const scope = String(req.query.scope || "all");
    let reports = [];
    let studentReportCardData = null;
    let classReportCardData = null;
    let adminOverallReportCardData = null;
    const gradeFromPercentage = (percentage) => {
      if (percentage >= 90) return "A+";
      if (percentage >= 80) return "A";
      if (percentage >= 70) return "B+";
      if (percentage >= 60) return "B";
      if (percentage >= 50) return "C";
      if (percentage >= 40) return "D";
      return "F";
    };

    if (scope === "all") {
      reports = await ExamReport.find().sort({ createdAt: -1 });
      if (!reports.length && req.user?.role === "Admin") {
        const fallback = await buildAdminFallbackReport();
        reports = fallback ? [fallback] : [];
      }
    } else if (scope.startsWith("exam:")) {
      const reportId = scope.replace("exam:", "").trim();
      const report = await ExamReport.findById(reportId);
      if (!report) return fail(res, 404, "Exam report not found");
      reports = [report];
    } else if (scope.startsWith("student-exam:")) {
      const reportId = scope.replace("student-exam:", "").trim();
      const studentId = req.user?.studentId || "";
      if (!studentId) return fail(res, 400, "Student identity missing in session");

      const student = await Student.findOne({ studentId });
      if (!student) return fail(res, 404, "Student not found");
      const classTeacher = await Teacher.findOne({
        assignedClasses: { $elemMatch: { class: student.class, section: student.section } }
      }).select("name");
      const isCurrentScope = reportId === `current-${studentId}`;
      const report = isCurrentScope ? null : await ExamReport.findById(reportId);
      if (!isCurrentScope && !report) return fail(res, 404, "Exam report not found");

      const fallbackPercentage = student.subjects?.length
        ? student.subjects.reduce((sum, sub) => sum + Number(sub.marks || 0), 0) / student.subjects.length
        : 0;
      const fallbackAttendance = student.totalDays ? (student.presentDays / student.totalDays) * 100 : 0;
      const fallbackGrade = fallbackPercentage >= 90 ? "A+" : fallbackPercentage >= 80 ? "A" : fallbackPercentage >= 70 ? "B+" : fallbackPercentage >= 60 ? "B" : fallbackPercentage >= 50 ? "C" : fallbackPercentage >= 40 ? "D" : "F";
      const studentRow = isCurrentScope
        ? {
            studentId: student.studentId,
            name: student.name,
            classSection: `${student.class}-${student.section}`,
            percentage: Number(fallbackPercentage.toFixed(2)),
            attendance: Number(fallbackAttendance.toFixed(2)),
            grade: fallbackGrade,
            rank: 1
          }
        : (report.students || []).find((row) => row.studentId === studentId);
      if (!studentRow) return fail(res, 404, "Selected exam does not contain this student's report");

      const avg = student.subjects?.length
        ? student.subjects.reduce((sum, sub) => sum + Number(sub.marks || 0), 0) / student.subjects.length
        : Number(studentRow.percentage || 0);
      const attendance = student.totalDays
        ? (student.presentDays / student.totalDays) * 100
        : Number(studentRow.attendance || 0);
      const attendanceAbsences = Math.max(Number(student.totalDays || 0) - Number(student.presentDays || 0), 0);
      const now = new Date();
      const schoolYear = `${now.getFullYear()}-${now.getFullYear() + 1}`;
      const dateLabel = now.toLocaleDateString("en-GB");

      studentReportCardData = {
        schoolName: "Little Flower Matric Hr.Sec.School",
        schoolAddress: "Sathyamangalam-638401",
        studentId: student.studentId,
        studentName: student.name,
        rollNo: student.rollNo || student.studentId,
        grade: `Class ${student.class} - Section ${student.section}`,
        schoolYear,
        term: `${isCurrentScope ? "Current" : report.term} - ${isCurrentScope ? "Current Assessment" : report.exam}`,
        date: isCurrentScope ? dateLabel : (report.dateRange || dateLabel),
        teacher: classTeacher?.name || "Class Teacher",
        parentName: student.parentName || "-",
        parentContact: student.parentContact || "-",
        dob: student.dob || "-",
        bloodGroup: student.bloodGroup || "-",
        absences: attendanceAbsences,
        tardies: 0,
        earlyDismissals: 0,
        penalties: Number(student.drawbacks || 0),
        feesPending: Number(student.feesPending || 0),
        assignmentsCompleted: Number(student.assignmentsCompleted || 0),
        assignmentsTotal: Number(student.assignmentsTotal || 0),
        actionRequired: student.actionRequired || "Keep up the good work!",
        overallPercentage: Number(avg.toFixed(2)),
        attendance: Number(attendance.toFixed(2)),
        remarks:
          Number(studentRow.percentage || avg) >= 85
            ? "Excellent progress in this exam. Keep up the consistent effort."
            : Number(studentRow.percentage || avg) >= 70
              ? "Good performance in this exam. Continue focused preparation."
              : Number(studentRow.percentage || avg) >= 50
                ? "Satisfactory exam score. Target stronger practice in weak subjects."
                : "Below expected in this exam. Immediate improvement plan is recommended.",
        subjects: (student.subjects || []).map((subject) => {
          const percentage = subject.totalMarks ? (Number(subject.marks || 0) / Number(subject.totalMarks || 100)) * 100 : 0;
          const grade = gradeFromPercentage(percentage);
          return {
            subject: subject.name,
            marks: Number(subject.marks || 0),
            totalMarks: Number(subject.totalMarks || 100),
            percentage: Number(percentage.toFixed(2)),
            grade
          };
        })
      };

      reports = [
        {
          _id: isCurrentScope ? `current-${student.studentId}` : report._id,
          exam: isCurrentScope ? "Current Assessment" : report.exam,
          term: isCurrentScope ? "Current" : report.term,
          year: isCurrentScope ? String(new Date().getFullYear()) : report.year,
          dateRange: isCurrentScope ? "Latest Academic Snapshot" : report.dateRange,
          overallStats: {
            totalStudents: 1,
            averagePercentage: Number(studentRow.percentage || 0),
            averageAttendance: Number(studentRow.attendance || 0),
            passPercentage: Number(studentRow.percentage || 0) >= 40 ? 100 : 0,
            topPerformers: Number(studentRow.percentage || 0) >= 90 ? 1 : 0,
            needsImprovement: Number(studentRow.percentage || 0) < 60 ? 1 : 0
          },
          students: [studentRow]
        }
      ];
    } else if (scope.startsWith("student:")) {
      const studentId = scope.replace("student:", "").trim();
      const student = await Student.findOne({ studentId });
      if (!student) return fail(res, 404, "Student not found");
      const classTeacher = await Teacher.findOne({
        assignedClasses: { $elemMatch: { class: student.class, section: student.section } }
      }).select("name");

      const avg = student.subjects?.length
        ? student.subjects.reduce((sum, sub) => sum + Number(sub.marks || 0), 0) / student.subjects.length
        : 0;
      const attendance = student.totalDays ? (student.presentDays / student.totalDays) * 100 : 0;
      const attendanceAbsences = Math.max(Number(student.totalDays || 0) - Number(student.presentDays || 0), 0);
      const now = new Date();
      const schoolYear = `${now.getFullYear()}-${now.getFullYear() + 1}`;
      const dateLabel = now.toLocaleDateString("en-GB");

      reports = [
        {
          _id: `student-${student.studentId}`,
          exam: `Student Summary - ${student.studentId}`,
          term: "Current",
          year: String(new Date().getFullYear()),
          dateRange: "Current Academic Snapshot",
          overallStats: {
            totalStudents: 1,
            averagePercentage: Number(avg.toFixed(2)),
            averageAttendance: Number(attendance.toFixed(2)),
            passPercentage: avg >= 40 ? 100 : 0,
            topPerformers: avg >= 90 ? 1 : 0,
            needsImprovement: avg < 60 ? 1 : 0
          },
          students: [
            {
              studentId: student.studentId,
              name: student.name,
              classSection: `${student.class}-${student.section}`,
              percentage: Number(avg.toFixed(2)),
              attendance: Number(attendance.toFixed(2)),
              grade: avg >= 90 ? "A+" : avg >= 75 ? "A" : avg >= 60 ? "B" : avg >= 40 ? "C" : "D",
              rank: 1
            }
          ]
        }
      ];

      studentReportCardData = {
        schoolName: "Little Flower Matric Hr.Sec.School",
        schoolAddress: "Sathyamangalam-638401",
        studentId: student.studentId,
        studentName: student.name,
        rollNo: student.rollNo || student.studentId,
        grade: `Class ${student.class} - Section ${student.section}`,
        schoolYear,
        term: "Current Term",
        date: dateLabel,
        teacher: classTeacher?.name || "Class Teacher",
        parentName: student.parentName || "-",
        parentContact: student.parentContact || "-",
        dob: student.dob || "-",
        bloodGroup: student.bloodGroup || "-",
        absences: attendanceAbsences,
        tardies: 0,
        earlyDismissals: 0,
        penalties: Number(student.drawbacks || 0),
        feesPending: Number(student.feesPending || 0),
        assignmentsCompleted: Number(student.assignmentsCompleted || 0),
        assignmentsTotal: Number(student.assignmentsTotal || 0),
        actionRequired: student.actionRequired || "Keep up the good work!",
        overallPercentage: Number(avg.toFixed(2)),
        attendance: Number(attendance.toFixed(2)),
        remarks:
          avg >= 85
            ? "Excellent progress. Continue the same dedication in all subjects."
            : avg >= 70
              ? "Good performance. Focus on consistency to achieve higher distinction."
              : avg >= 50
                ? "Satisfactory progress. Additional revision is recommended for core subjects."
                : "Needs focused improvement. Please follow remedial guidance from class teacher.",
        subjects: (student.subjects || []).map((subject) => {
          const percentage = subject.totalMarks ? (Number(subject.marks || 0) / Number(subject.totalMarks || 100)) * 100 : 0;
          const grade = gradeFromPercentage(percentage);
          return {
            subject: subject.name,
            marks: Number(subject.marks || 0),
            totalMarks: Number(subject.totalMarks || 100),
            percentage: Number(percentage.toFixed(2)),
            grade
          };
        })
      };
    } else if (scope.startsWith("class:")) {
      const scopeParts = scope.replace("class:", "").split(":");
      const parts = scopeParts[0];
      const requestedExam = scopeParts[1] || "Current";
      const [classNumRaw, sectionRaw] = parts.split("-");
      const classNum = Number(classNumRaw);
      const section = String(sectionRaw || "").trim().toUpperCase();

      const students = await Student.find({ class: classNum, section });
      if (!students.length) return fail(res, 404, "No students found for selected class scope");
      const classTeacher = await Teacher.findOne({
        assignedClasses: { $elemMatch: { class: classNum, section } }
      }).select("name");

      const mappedStudents = students.map((student) => {
        const avg = student.subjects?.length
          ? student.subjects.reduce((sum, sub) => sum + Number(sub.marks || 0), 0) / student.subjects.length
          : 0;
        const attendance = student.totalDays ? (student.presentDays / student.totalDays) * 100 : 0;
        const status = avg >= 90 ? "Excellent" : avg >= 75 ? "Good" : avg >= 60 ? "Average" : "Weak";
        return {
          studentId: student.studentId,
          rollNo: student.rollNo || student.studentId,
          name: student.name,
          classSection: `${student.class}-${student.section}`,
          percentage: Number(avg.toFixed(2)),
          attendance: Number(attendance.toFixed(2)),
          grade: avg >= 90 ? "A+" : avg >= 75 ? "A" : avg >= 60 ? "B" : avg >= 40 ? "C" : "D",
          status,
          drawbacks: Number(student.drawbacks || 0),
          feesPending: Number(student.feesPending || 0)
        };
      });

      const averagePercentage = mappedStudents.reduce((sum, s) => sum + s.percentage, 0) / mappedStudents.length;
      const averageAttendance = mappedStudents.reduce((sum, s) => sum + s.attendance, 0) / mappedStudents.length;

      const parseRollParts = (roll) => {
        const raw = String(roll || "").toUpperCase().trim();
        const match = raw.match(/^(\d+)([A-Z]*)(\d+)$/);
        if (!match) return { classPart: Number.MAX_SAFE_INTEGER, sectionPart: "Z", rollPart: Number.MAX_SAFE_INTEGER, raw };
        return {
          classPart: Number(match[1] || 0),
          sectionPart: String(match[2] || "Z"),
          rollPart: Number(match[3] || 0),
          raw
        };
      };

      const ranked = [...mappedStudents]
        .sort((a, b) => {
          const aRoll = parseRollParts(a.rollNo || a.studentId);
          const bRoll = parseRollParts(b.rollNo || b.studentId);
          if (aRoll.classPart !== bRoll.classPart) return aRoll.classPart - bRoll.classPart;
          if (aRoll.sectionPart !== bRoll.sectionPart) return aRoll.sectionPart.localeCompare(bRoll.sectionPart);
          if (aRoll.rollPart !== bRoll.rollPart) return aRoll.rollPart - bRoll.rollPart;
          return aRoll.raw.localeCompare(bRoll.raw);
        })
        .map((student, index) => ({ ...student, rank: index + 1 }));

      reports = [
        {
          _id: `class-${classNum}-${section}`,
          exam: requestedExam,
          term: "Current",
          year: String(new Date().getFullYear()),
          dateRange: "Current Academic Snapshot",
          overallStats: {
            totalStudents: ranked.length,
            averagePercentage: Number(averagePercentage.toFixed(2)),
            averageAttendance: Number(averageAttendance.toFixed(2)),
            passPercentage: Number(((ranked.filter((s) => s.percentage >= 40).length / ranked.length) * 100).toFixed(2)),
            topPerformers: ranked.filter((s) => s.percentage >= 90).length,
            needsImprovement: ranked.filter((s) => s.percentage < 60).length
          },
          students: ranked
        }
      ];

      classReportCardData = {
        schoolName: "Little Flower Matric Hr.Sec.School",
        schoolAddress: "Sathyamangalam-638401",
        classNum,
        section,
        exam: requestedExam,
        teacherName: classTeacher?.name || "Class Teacher",
        totalStudents: ranked.length,
        overallPercentage: Number(averagePercentage.toFixed(2)),
        overallAttendance: Number(averageAttendance.toFixed(2)),
        totalDrawbacks: ranked.reduce((sum, row) => sum + Number(row.drawbacks || 0), 0),
        excellentCount: ranked.filter((row) => row.percentage >= 90).length,
        goodCount: ranked.filter((row) => row.percentage >= 75 && row.percentage < 90).length,
        averageCount: ranked.filter((row) => row.percentage >= 60 && row.percentage < 75).length,
        weakCount: ranked.filter((row) => row.percentage < 60).length,
        insight: ranked.filter((row) => row.percentage < 60).length > 0
          ? `${ranked.filter((row) => row.percentage < 60).length} student(s) need immediate support in this class.`
          : "All students are performing above baseline expectations.",
        students: ranked.map((row) => ({
          rollNo: row.rollNo || row.studentId,
          studentId: row.studentId,
          name: row.name,
          average: Number(row.percentage || 0),
          attendance: Number(row.attendance || 0),
          status: row.status || "-",
          drawbacks: Number(row.drawbacks || 0)
        }))
      };
    } else {
      reports = await ExamReport.find().sort({ createdAt: -1 });
      if (!reports.length && req.user?.role === "Admin") {
        const fallback = await buildAdminFallbackReport();
        reports = fallback ? [fallback] : [];
      }
    }

    if (!reports.length) return fail(res, 404, "No reports found for requested scope");

    let payload;

    if (format === "csv") {
      const csv = toCsv(
        [
          "examId",
          "exam",
          "term",
          "year",
          "studentId",
          "studentName",
          "classSection",
          "percentage",
          "attendance",
          "grade",
          "rank"
        ],
        reports.flatMap((report) =>
          (report.students || []).map((student) => [
            String(report._id),
            report.exam,
            report.term,
            report.year,
            student.studentId,
            student.name,
            student.classSection,
            student.percentage,
            student.attendance,
            student.grade,
            student.rank
          ])
        )
      );

      payload = createDownloadPayload({
        filename: `progressiq-reports-${new Date().toISOString().slice(0, 10)}.csv`,
        mimeType: "text/csv;charset=utf-8",
        buffer: Buffer.from(csv, "utf8")
      });
    } else {
      if (scope === "all" && req.user?.role === "Admin") {
        const uniqueStudents = new Set(
          reports.flatMap((report) => (report.students || []).map((student) => student.studentId))
        );
        const weightedTotal = reports.reduce(
          (sum, report) => sum + Number(report.overallStats?.averagePercentage || 0) * Number(report.overallStats?.totalStudents || 0),
          0
        );
        const weightedAttendance = reports.reduce(
          (sum, report) => sum + Number(report.overallStats?.averageAttendance || 0) * Number(report.overallStats?.totalStudents || 0),
          0
        );
        const totalPopulation = reports.reduce((sum, report) => sum + Number(report.overallStats?.totalStudents || 0), 0) || 1;
        const bestExam = [...reports].sort((a, b) => Number(b.overallStats?.averagePercentage || 0) - Number(a.overallStats?.averagePercentage || 0))[0];
        const supportExam = [...reports].sort((a, b) => Number(b.overallStats?.needsImprovement || 0) - Number(a.overallStats?.needsImprovement || 0))[0];

        adminOverallReportCardData = {
          schoolName: "Little Flower Matric Hr.Sec.School",
          schoolAddress: "Sathyamangalam-638401",
          year: String(new Date().getFullYear()),
          generatedOn: new Date().toLocaleDateString("en-GB"),
          totalReports: reports.length,
          totalStudents: uniqueStudents.size,
          averagePercentage: Number((weightedTotal / totalPopulation).toFixed(2)),
          averageAttendance: Number((weightedAttendance / totalPopulation).toFixed(2)),
          bestExam: bestExam?.exam || "-",
          supportExam: supportExam?.exam || "-",
          examRows: reports.map((report) => ({
            exam: report.exam,
            term: report.term,
            year: report.year,
            totalStudents: Number(report.overallStats?.totalStudents || 0),
            averagePercentage: Number(report.overallStats?.averagePercentage || 0),
            averageAttendance: Number(report.overallStats?.averageAttendance || 0),
            passPercentage: Number(report.overallStats?.passPercentage || 0),
            topPerformers: Number(report.overallStats?.topPerformers || 0),
            needsImprovement: Number(report.overallStats?.needsImprovement || 0)
          }))
        };
      }

      const lines = [];
      lines.push("ProgressIQ - Academic Report Export");
      lines.push(`Generated At: ${new Date().toISOString()}`);
      lines.push(`Scope: ${scope}`);
      lines.push("");

      reports.forEach((report) => {
        lines.push(`${report.exam} | ${report.term} | ${report.year}`);
        lines.push(`Date Range: ${report.dateRange}`);
        lines.push(
          `Students: ${report.overallStats?.totalStudents || 0}, Avg%: ${report.overallStats?.averagePercentage || 0}, Attendance: ${report.overallStats?.averageAttendance || 0}`
        );
        (report.students || []).slice(0, 20).forEach((student) => {
          lines.push(
            `- ${student.rank || "-"} | ${student.studentId} | ${student.name} | ${student.classSection} | ${student.percentage}% | ${student.grade}`
          );
        });
        lines.push("");
      });

      const pdfBuffer =
        (scope.startsWith("student:") || scope.startsWith("student-exam:")) && studentReportCardData
          ? buildStudentReportCardPdf(studentReportCardData)
          : scope === "all" && req.user?.role === "Admin" && adminOverallReportCardData
            ? buildAdminOverallReportPdf(adminOverallReportCardData)
          : scope.startsWith("class:") && classReportCardData
            ? buildClassReportCardPdf(classReportCardData)
          : buildSimplePdf(lines);
      payload = createDownloadPayload({
        filename: (scope.startsWith("student:") || scope.startsWith("student-exam:")) && studentReportCardData
          ? `report-card-${studentReportCardData.studentId}-${new Date().toISOString().slice(0, 10)}.pdf`
          : scope === "all" && req.user?.role === "Admin" && adminOverallReportCardData
            ? `admin-overall-report-card-${new Date().toISOString().slice(0, 10)}.pdf`
          : scope.startsWith("class:") && classReportCardData
            ? `class-report-card-${classReportCardData.classNum}-${classReportCardData.section}-${new Date().toISOString().slice(0, 10)}.pdf`
          : `progressiq-reports-${new Date().toISOString().slice(0, 10)}.pdf`,
        mimeType: "application/pdf",
        buffer: pdfBuffer
      });
    }

    await ActivityLog.create({
      actorUserId: req.user?._id || null,
      actorName: req.user?.name || "Unknown User",
      role: req.user?.role || "System",
      type: "download",
      action: "Requested report download",
      details: `Scope: ${scope}, format: ${String(format).toUpperCase()}`
    });

    return ok(res, payload, "Report download generated");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
