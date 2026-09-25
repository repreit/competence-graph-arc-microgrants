import { Hono } from "hono";
import { contentPublicKey } from "../../../../common/js/delta.js";
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
    const body = c.get("body");
    const content = body.content;
    const signature = body.signature;
    const seq = body.seq;
    const prev_hash = body.prev_hash ?? null;
    if (typeof content !== "string" || typeof signature !== "string") {
        return c.json({ error: "invalid_json" }, 400);
    }
    const publicKey = contentPublicKey(content);
    if (publicKey == null) {
        return c.json({ error: "invalid_content" }, 400);
    }
    const binding = await findActiveByKey(account.id, publicKey);
    if (!binding) {
        return c.json({ error: "unbound_key" }, 401);
    }
    const verified = await verifyDeltaSignature(
        publicKey,
        { seq, prev_hash, content },
        signature,
    );
    if (!verified) {
        return c.json({ error: "signature" }, 401);
    }
    const appended = await appendDelta(account.id, {
        seq,
        prev_hash,
        content,
        signature,
    });
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
