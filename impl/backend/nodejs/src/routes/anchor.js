import { Hono } from "hono";

const anchor = new Hono();

anchor.post("/", (c) => c.json({ error: "not_implemented" }, 501));

export default anchor;
