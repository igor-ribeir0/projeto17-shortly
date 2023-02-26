import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import { db } from "./config/dataBase.js";
import bcrypt from "bcrypt";
import { v4 as uuid } from 'uuid';

dotenv.config();

const app = express();

const signInSchema = joi.object(
    {
        email: joi.string().email().required(),
        password: joi.string().required()
    }
);

app.use(express.json());
app.use(cors());
app.listen(process.env.PORT);

app.post("/signIn", async(req, res) => {
    const { email, password } = req.body;
    const userTest = { email, password };
    const validation = signInSchema.validate(userTest, { abortEarly: false });

    if(validation.error){
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try{
        const user = await db.query(
            `
                SELECT * FROM users WHERE email = $1
            `,
            [email]
        );

        const comparePassword = bcrypt.compareSync(password, user.rows.password);

        if(user.rowCount === 0 || comparePassword === false){
            return res.sendStatus(401);
        }

        const token = uuid();
        const userToken = { token: token};

        await db.query(
            `
                INSERT INTO sessions ("userId", token)
                VALUES ($1, $2)
            `,
            [user.rows.id, token]
        );

        res.status(200).send(userToken);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});