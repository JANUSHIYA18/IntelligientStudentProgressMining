import { Router } from "express";
import { downloadReport, getExamReportById, getExamReports } from "../controllers/report.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();
router.use(protect);
router.get("/exams", getExamReports);
router.get("/exams/:id", getExamReportById);
router.get("/download", downloadReport);

export default router;
