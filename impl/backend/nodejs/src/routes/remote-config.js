import { Hono } from "hono";

const remoteConfig = new Hono();

remoteConfig.get("/load", (c) => c.json({ config: null }));

export default remoteConfig;
