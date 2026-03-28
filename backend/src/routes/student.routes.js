import { Router } from "express";
import { getDashboard, getGraphs, getRecommendations } from "../controllers/student.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";

const router = Router();
router.use(protect, allowRoles("Student", "Admin", "Faculty"));
router.get("/:studentId/dashboard", getDashboard);
router.get("/:studentId/recommendations", getRecommendations);
router.get("/:studentId/graphs", getGraphs);

export default router;
