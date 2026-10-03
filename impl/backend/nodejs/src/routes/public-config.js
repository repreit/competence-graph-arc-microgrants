import { Hono } from "hono";

const publicConfig = new Hono();

publicConfig.get("/", (c) => c.json({ config: null }));

export default publicConfig;
