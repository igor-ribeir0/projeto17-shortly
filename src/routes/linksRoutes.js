import { shortenUrl, urlId, openUrl, deleteUrl } from "../controller/links.js";
import { Router } from "express";

const linksRouter = Router();

linksRouter.post("/urls/shorten", shortenUrl);
linksRouter.get("/urls/:id", urlId);
linksRouter.get("/urls/open/:shortUrl", openUrl);
linksRouter.delete("/urls/:id", deleteUrl);

export default linksRouter;