import { Router } from "express";
import {
  createAnnouncement,
  createAssignment,
  deleteAnnouncement,
  deleteAssignment,
  getAssignmentProgress,
  getAnnouncements,
  getAssignments,
  getExamWindow,
  getMarkStatuses,
  getMyClasses,
  getOverview,
  requestMarkEntryExtension,
  getStudentDetails,
  getStudents,
  saveAssignmentProgressBulk,
  saveAttendance,
  saveAttendanceBulk,
  saveMarks,
  saveMarksBulk,
  updateAnnouncement,
  updateAssignment,
  uploadCsvMarks
} from "../controllers/faculty.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";

const router = Router();
router.use(protect, allowRoles("Faculty", "Admin"));
router.get("/my-classes", getMyClasses);
router.get("/overview", getOverview);
router.get("/exam-window", getExamWindow);
router.post("/exam-window/extension-request", requestMarkEntryExtension);
router.get("/students", getStudents);
router.get("/students/:studentId", getStudentDetails);
router.get("/mark-statuses", getMarkStatuses);
router.put("/students/:studentId/marks", saveMarks);
router.put("/students/:studentId/attendance", saveAttendance);
router.post("/marks/bulk", saveMarksBulk);
router.post("/attendance/bulk", saveAttendanceBulk);
router.post("/marks/upload-csv", uploadCsvMarks);
router.post("/assignments", createAssignment);
router.get("/assignments", getAssignments);
router.put("/assignments/:assignmentId", updateAssignment);
router.delete("/assignments/:assignmentId", deleteAssignment);
router.get("/assignments/:assignmentId/progress", getAssignmentProgress);
router.post("/assignments/:assignmentId/progress", saveAssignmentProgressBulk);
router.post("/announcements", createAnnouncement);
router.get("/announcements", getAnnouncements);
router.put("/announcements/:announcementId", updateAnnouncement);
router.delete("/announcements/:announcementId", deleteAnnouncement);

export default router;
