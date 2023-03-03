import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/authRoutes.js";
import linksRouter from "./routes/linksRoutes.js";
import usersRouter from "./routes/usersRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use([authRouter, linksRouter, usersRouter]);

app.listen(process.env.PORT);