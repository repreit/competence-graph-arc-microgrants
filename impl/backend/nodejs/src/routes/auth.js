import { Hono } from "hono";
import {
    setSession,
    clearSessionToken,
} from "../adapters/db/postgres/tables/sessions.js";
import { issueNonce } from "../adapters/auth/siwe/nonce.js";
import {
    createSessionToken,
    sessionExpiresAt,
} from "../adapters/auth/siwe/session.js";
import { verifySignedMessage } from "../adapters/auth/siwe/verify.js";
import { chainId } from "../config.js";
import { requireJson } from "../middleware/json.js";
import {
    bearerToken,
    publicAccount,
    requireSession,
} from "../middleware/session.js";

const auth = new Hono();

auth.get("/nonce", async (c) =>
    c.json({
        nonce: await issueNonce(),
        chainId,
    }),
);

auth.post("/verify", requireJson, async (c) => {
    const body = c.get("body");
    const message = body.message;
    const signature = body.signature;
    if (typeof message !== "string" || typeof signature !== "string") {
        return c.json({ error: "invalid_json" }, 400);
    }
    const result = await verifySignedMessage({ message, signature });
    if (!result.ok) {
        return c.json({ error: result.error }, 401);
    }
    const token = createSessionToken();
    const row = await setSession(result.address, token, sessionExpiresAt());
    return c.json({ ...publicAccount(row), token });
});

auth.get("/me", requireSession, async (c) => {
    return c.json(publicAccount(c.get("account")));
});

auth.post("/logout", requireSession, async (c) => {
    await clearSessionToken(bearerToken(c));
    return c.json({ ok: true });
});

export default auth;
