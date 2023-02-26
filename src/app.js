import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import { db } from "./config/dataBase.js";
import bcrypt from "bcrypt";
import { v4 as uuid } from 'uuid';

/*{
  "name": "Naruto",
  "email": "naruto@gg.com",
  "password": "narutinho",
  "confirmPassword": "narutinho"
}
*/

dotenv.config();

const app = express();

const signInSchema = joi.object(
    {
        email: joi.string().email().required(),
        password: joi.string().required()
    }
);

const signUpSchema = joi.object(
    {
        name: joi.string().max(60).required(),
        email: joi.string().email().required(),
        password: joi.string().required(),
        confirmPassword: joi.string().valid(joi.ref('password')).required()
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

        if(user.rowCount !== 0){
            const comparePassword = bcrypt.compareSync(password, user.rows[0].password);

            if(comparePassword === false) return res.sendStatus(401);
        }

        if(user.rowCount === 0){
            return res.sendStatus(401);
        }

        const token = uuid();
        const userToken = { token: token};

        await db.query(
            `
                INSERT INTO sessions ("userId", token)
                VALUES ($1, $2)
            `,
            [user.rows[0].id, token]
        );

        res.status(200).send(userToken);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});

app.post("/signUp", async(req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    const registerTest = { name, email, password, confirmPassword };
    const validation = signUpSchema.validate(registerTest, { abortEarly: false });

    if(validation.error){
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try{
        const user = await db.query(
            `
                SELECT * from users WHERE email = $1
            `,
            [email]
        );

        if(user.rowCount !== 0) return res.sendStatus(409);

        const hash = bcrypt.hashSync(password, 10);

        await db.query(
            `
                INSERT INTO users (name, email, password)
                VALUES ($1, $2, $3)
            `,
            [name, email, hash]
        );

        res.sendStatus(201);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});