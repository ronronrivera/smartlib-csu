import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { changeEmail, changeNumber, changePassword, studentProfile } from "../controller/studentProfile.controller.js";

const router = express.Router();


router.get("/student-profile", protectRoute, studentProfile);

router.patch("/change-password", protectRoute, changePassword);
router.patch("/change-email", protectRoute, changeEmail);
router.patch("/change-number", protectRoute, changeNumber);

export default router;
