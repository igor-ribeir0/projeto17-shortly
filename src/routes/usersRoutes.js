import { userMe, rank } from "../controller/users.js";
import { Router } from "express";

const usersRouter = Router();

usersRouter.get("/users/me", userMe);
usersRouter.get("/ranking", rank);

export default usersRouter;