import { Hono } from "hono";
import { contentPublicKey, parseDelta } from "../../../../common/js/delta.js";
import { verifyDeltaSignature } from "../../../../common/js/verify.js";
import { findActiveByKey } from "../adapters/db/postgres/tables/bindings.js";
import {
    appendDelta,
    nextLink,
} from "../adapters/db/postgres/tables/deltas.js";
import { requireJson } from "../middleware/json.js";
import { requireSession } from "../middleware/session.js";

const deltas = new Hono();

deltas.get("/tip", requireSession, async (c) => {
    return c.json(await nextLink(c.get("account").id));
});

deltas.post("/append", requireSession, requireJson, async (c) => {
    const account = c.get("account");
    const delta = parseDelta(c.get("body"));
    if (!delta) {
        return c.json({ error: "invalid_request" }, 400);
    }
    const publicKey = contentPublicKey(delta.content);
    if (publicKey == null) {
        return c.json({ error: "invalid_content" }, 400);
    }
    const binding = await findActiveByKey(account.id, publicKey);
    if (!binding) {
        return c.json({ error: "unbound_key" }, 401);
    }
    const verified = await verifyDeltaSignature(
        publicKey,
        delta,
        delta.signature,
    );
    if (!verified) {
        return c.json({ error: "signature" }, 401);
    }
    const appended = await appendDelta(account.id, delta);
    if (!appended.ok) {
        if (appended.error === "stale_tip") {
            return c.json(
                { error: "stale_tip", ...(await nextLink(account.id)) },
                409,
            );
        }
        return c.json({ error: appended.error }, 400);
    }
    return c.json({ ok: true, seq: appended.row.seq });
});

export default deltas;
