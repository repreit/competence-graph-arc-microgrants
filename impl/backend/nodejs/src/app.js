import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./routes/auth.js";
import bindings from "./routes/bindings.js";
import deltas from "./routes/deltas.js";
import publicConfig from "./routes/public-config.js";

const app = new Hono();

app.use(
    "*",
    cors({
        origin: "*",
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: ["GET", "POST", "OPTIONS"],
    }),
);

app.route("/public-config", publicConfig);
app.route("/auth", auth);
app.route("/bindings", bindings);
app.route("/deltas", deltas);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal" }, 500);
});

export default app;
