import { db } from "../config/dataBase.js";

export async function userMe(req, res){
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
            SELECT "id", "shortUrl", "url", "visitCount" FROM urls WHERE "userId" = $1
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
            visitCount: getUser.rows[0].score,
            shortenedUrls: getUrls.rows
        };

        res.status(200).send(returnObj);
    }
    catch(error){
        res.status(500).send(error.message);
    }
};

export async function rank(req, res){
    try{
        const ranking = await db.query(
            `
                SELECT users.id, users.name, 
                CAST(COUNT (urls.id) AS INTEGER) AS "linksCount",
                CAST(COALESCE(SUM("visitCount"), 0) AS INTEGER) as "visitCount"
                FROM users LEFT JOIN urls on users.id = urls."userId"
                GROUP BY users.id, users.name
                ORDER BY "visitCount" DESC
                LIMIT 10
            `
        );

        return res.status(200).send(ranking.rows);
    }
    catch(error){
        res.status(500).send(error.message);
    }
};