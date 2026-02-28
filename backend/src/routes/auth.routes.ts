import express, { Router } from "express"
import {loginController, logoutController, refreshToken, signupController } from "../controller/auth.controller.ts";

const router: Router = express.Router()

router.post("/signup", signupController);
router.post("/login", loginController);
router.post("/logout", logoutController);

router.post("/refresh-token", refreshToken);

export default router;
