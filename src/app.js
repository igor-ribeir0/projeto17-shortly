import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import { db } from "./config/dataBase.js";
import bcrypt from "bcrypt";
import { v4 as uuid } from 'uuid';
import { nanoid } from "nanoid";

/*{
  "name": "Razer",
  "email": "razer@gg.com",
  "password": "razer",
  "confirmPassword": "razer"
  "token": "19ed9862-5c37-4db9-a94d-d25754b613a7"
}
*/

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.listen(process.env.PORT);

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

const urlSchema = joi.object(
    {
        url: joi.string().uri().required()
    }
);

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

app.post("/urls/shorten", async(req, res) => {
    const { url } = req.body;
    const { authorization } = req.headers
    const token = authorization?.replace("Bearer ", "");

    if(!token) return res.sendStatus(401);

    const urlTest = { url };
    const validation = urlSchema.validate(urlTest, { abortEarly: true });

    if(validation.error){
        const error = validation.error.details;
        return res.status(422).send(error);
    }

    try{
        const sessionTest = await db.query(
            `
                SELECT * FROM sessions WHERE token = $1
            `,
            [token]
        );
        

        if(sessionTest.rowCount === 0) return res.sendStatus(401);

        const urlExist = await db.query(
            `
                Select * from urls WHERE url = $1
            `,
            [url]
        );

        if(urlExist.rowCount !== 0) return res.sendStatus(409);

        const urlTable = await db.query(
            `
                SELECT * FROM urls
            `
        );

        const shortUrl = nanoid(8);

        await db.query(
            `
                INSERT INTO urls (url, "shortUrl")
                VALUES ($1, $2)
            `,
            [url, shortUrl]
        );

        const urlBody = { 
            id: urlTable.rowCount + 1,
            shortUrl: shortUrl
        };

        await db.query(
            `
                INSERT INTO "urlsVisit" ("shortUrl", score)
                Values ($1, $2)
            `,
            [shortUrl, 0]
        );

        res.status(201).send(urlBody);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});

app.get("/urls/:id", async(req, res) => {
    const { id } = req.params;

    try{
        const urlExist = await db.query(
            `
                SELECT * FROM urls WHERE id = $1
            `,
            [id]
        );

        if(urlExist.rowCount === 0) return res.sendStatus(404);

        const urlBody = {
            id: urlExist.rows[0].id,
            shortUrl: urlExist.rows[0].shortUrl,
            url: urlExist.rows[0].url
        };

        res.status(200).send(urlBody);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});

app.get("/urls/open/:shortUrl", async(req, res) => {
    const { shortUrl } = req.params;

    try{
        const shortUrlExist = await db.query(
            `
                SELECT * FROM "urlsVisit" WHERE "shortUrl" = $1
            `,
            [shortUrl]
        );

        if(shortUrlExist.rowCount === 0) return res.sendStatus(404);

        await db.query(
            `
                UPDATE "urlsVisit"
                SET score = $1
                WHERE "shortUrl" = $2
            `,
            [shortUrlExist.rows[0].score + 1, shortUrl]
        );

        const getUrl = await db.query(
            `
                SELECT * FROM urls WHERE "shortUrl" = $1
            `,
            [shortUrl]
        );

        res.redirect(getUrl.rows[0].url);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});