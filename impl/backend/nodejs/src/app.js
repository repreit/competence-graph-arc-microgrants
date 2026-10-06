import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { maxBodyBytes } from "./config.js";
import accounts from "./routes/accounts.js";
import auth from "./routes/auth.js";
import bindings from "./routes/bindings.js";
import deltas from "./routes/deltas.js";
import remoteConfig from "./routes/remote-config.js";

const app = new Hono();

app.use(
    "*",
    cors({
        origin: "*",
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: ["GET", "POST", "OPTIONS"],
    }),
);

app.use(
    "*",
    bodyLimit({
        maxSize: maxBodyBytes,
        onError: (c) => c.json({ error: "too_large" }, 413),
    }),
);

app.route("/remote-config", remoteConfig);
app.route("/auth", auth);
app.route("/accounts", accounts);
app.route("/bindings", bindings);
app.route("/deltas", deltas);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal" }, 500);
});

export default app;
