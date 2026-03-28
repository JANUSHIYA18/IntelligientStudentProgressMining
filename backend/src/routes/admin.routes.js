import { Router } from "express";
import {
  addStudent,
  addTeacher,
  deleteStudent,
  deleteTeacher,
  getActivities,
  getExamWindow,
  getExtensionRequests,
  getClassPerformance,
  getClasses,
  getDashboard,
  getSystemSettings,
  getPerformanceDistribution,
  reviewExtensionRequest,
  getStudents,
  getTeachers,
  updateSystemSettings,
  exportActivities
} from "../controllers/admin.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";

const router = Router();
router.use(protect, allowRoles("Admin"));
router.get("/dashboard", getDashboard);
router.get("/performance-distribution", getPerformanceDistribution);
router.get("/class-performance", getClassPerformance);
router.get("/activities", getActivities);
router.get("/activities/export", exportActivities);
router.post("/students", addStudent);
router.get("/students", getStudents);
router.delete("/students/:id", deleteStudent);
router.post("/teachers", addTeacher);
router.get("/teachers", getTeachers);
router.delete("/teachers/:id", deleteTeacher);
router.get("/classes", getClasses);
router.get("/settings", getSystemSettings);
router.put("/settings", updateSystemSettings);
router.get("/exam-window", getExamWindow);
router.get("/exam-extension-requests", getExtensionRequests);
router.put("/exam-extension-requests/:requestId", reviewExtensionRequest);

export default router;
