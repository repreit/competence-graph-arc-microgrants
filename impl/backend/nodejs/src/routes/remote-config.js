import { Hono } from "hono";

const remoteConfig = new Hono();

remoteConfig.get("/", (c) => c.json({ config: null }));

export default remoteConfig;
