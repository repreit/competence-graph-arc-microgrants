import { serve } from "@hono/node-server";
import app from "./app.js";
import { port } from "./config.js";

// TODO: handle SIGTERM/SIGINT for graceful shutdown before self-hosting.
serve({ fetch: app.fetch, port }, (info) => {
    console.log(`http://127.0.0.1:${info.port}`);
});
