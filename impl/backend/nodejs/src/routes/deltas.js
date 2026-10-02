import { Hono } from "hono";
import { parseContent, parseDelta } from "../../../../common/js/delta.js";
import { verifyDeltaSignature } from "../../../../common/js/verify.js";
import { findActiveBindingByKey } from "../adapters/db/postgres/tables/bindings.js";
import {
    appendDelta,
    nextLink,
} from "../adapters/db/postgres/tables/deltas.js";
import { requireJson } from "../middleware/json.js";
import { requireSession } from "../middleware/session.js";

const APPEND_TYPES = new Set(["history"]);

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
    const content = parseContent(delta.content);
    if (content == null || !APPEND_TYPES.has(content.type)) {
        return c.json({ error: "invalid_content" }, 400);
    }
    const publicKey = content.publicKey;
    const binding = await findActiveBindingByKey(account.id, publicKey);
    if (!binding) {
        return c.json({ error: "no_active_binding" }, 401);
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
