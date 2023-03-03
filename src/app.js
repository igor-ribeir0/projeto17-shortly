import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import { db } from "./config/dataBase.js";
import bcrypt from "bcrypt";
import { v4 as uuid } from 'uuid';
import { nanoid } from "nanoid";

/*{
  "name": "Beatles",
  "email": "beatles@gg.com",
  "password": "beatles",
  "confirmPassword": "beatles"
  "token": "cbfad55e-2a4e-4d78-8fa7-f69a32106cfd"
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
                INSERT INTO users (name, email, password, "visitCount")
                VALUES ($1, $2, $3, $4)
            `,
            [name, email, hash, 0]
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

        const shortUrl = nanoid(8);

        await db.query(
            `
                INSERT INTO urls ("userId", url, "shortUrl", score)
                VALUES ($1, $2, $3, $4)
            `,
            [sessionTest.rows[0].userId, url, shortUrl, 0]
        );

        const getUrl = await db.query(
            `
                SELECT * FROM urls WHERE url = $1;
            `,
            [url]
        );

        const urlBody = { 
            id: getUrl.rows[0].id,
            shortUrl: shortUrl
        };

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
                SELECT * FROM urls WHERE "shortUrl" = $1
            `,
            [shortUrl]
        );

        if(shortUrlExist.rowCount === 0) return res.sendStatus(404);

        await db.query(
            `
                UPDATE urls
                SET score = $1
                WHERE "shortUrl" = $2
            `,
            [shortUrlExist.rows[0].score + 1, shortUrl]
        );

        const getUser = await db.query(
            `
                SELECT * FROM users WHERE id = $1
            `,
            [shortUrlExist.rows[0].userId]
        );

        await db.query(
            `
                UPDATE users
                SET "visitCount" = $1
                WHERE id = $2
            `,
            [getUser.rows[0].visitCount + 1, getUser.rows[0].id]
        );

        res.redirect(shortUrlExist.rows[0].url);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});

app.delete("/urls/:id", async(req, res) => {
    const { id } = req.params;
    const { authorization } = req.headers
    const token = authorization?.replace("Bearer ", "");

    if(!token) return res.sendStatus(401);

    try{
        const sessionTest = await db.query(
            `
                SELECT * FROM sessions WHERE token = $1
            `,
            [token]
        );

        if(sessionTest.rowCount === 0) return res.sendStatus(401);

        const getUrl = await db.query(
            `
                SELECT * FROM urls WHERE id = $1
            `,
            [id]
        );

        if(getUrl.rowCount === 0) return res.sendStatus(404);

        if(sessionTest.rows[0].userId !== getUrl.rows[0].userId){
            return res.sendStatus(401);
        }

        await db.query(
            `
                DELETE FROM urls WHERE id = $1
            `,
            [id]
        );

        res.sendStatus(204);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});

app.get("/users/me", async(req, res) => {
    const { authorization } = req.headers
    const token = authorization?.replace("Bearer ", "");

    if(!token) return res.sendStatus(401);

    try{
        const sessionTest = await db.query(
            `
                SELECT * FROM sessions WHERE token = $1
            `,
            [token]
        );

        if(sessionTest.rowCount === 0) return res.sendStatus(401);

        const getUrls = await db.query(
            `
            SELECT "id", "shortUrl", "url", "score" FROM urls WHERE "userId" = $1
            `,
            [sessionTest.rows[0].userId]
        );

        const getUser = await db.query(
            `
                SELECT * FROM users WHERE id = $1
            `,
            [sessionTest.rows[0].userId]
        );

        const returnObj = {
            id: getUser.rows[0].id,
            name: getUser.rows[0].name,
            visitCount: getUser.rows[0].visitCount,
            shortenedUrls: getUrls.rows
        };

        res.status(200).send(returnObj);
    }
    catch(error){
        res.status(500).send(error.message);
    }
});