import { db } from "../config/dataBase.js";
import { nanoid } from "nanoid";
import { urlSchema } from "../schemas/linksSchema.js";

export async function shortenUrl(req, res){
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
                INSERT INTO urls ("userId", url, "shortUrl", "visitCount")
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
};

export async function urlId(req, res){
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
};

export async function openUrl(req, res){
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
                SET "visitCount" = $1
                WHERE "shortUrl" = $2
            `,
            [shortUrlExist.rows[0].visitCount + 1, shortUrl]
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
                SET score = $1
                WHERE id = $2
            `,
            [getUser.rows[0].score + 1, getUser.rows[0].id]
        );

        res.redirect(shortUrlExist.rows[0].url);
    }
    catch(error){
        res.status(500).send(error.message);
    }
};

export async function deleteUrl(req, res){
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
};