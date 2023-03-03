import { signIn, signUp } from "../controller/auth.js"
import { Router } from "express";

const authRouter = Router();

authRouter.post("/signIn", signIn);
authRouter.post("/signUp", signUp);

export default authRouter;