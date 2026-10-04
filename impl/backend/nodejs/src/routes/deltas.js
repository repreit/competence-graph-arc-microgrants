import { Hono } from "hono";
import { getAddress } from "viem";
import { parseContent, parseDelta } from "../../../../common/js/delta.js";
import { verifyDeltaSignature } from "../../../../common/js/verify.js";
import { findAccountByAddress } from "../adapters/db/postgres/tables/accounts.js";
import { findActiveBindingByKey } from "../adapters/db/postgres/tables/bindings.js";
import {
    appendDelta,
    listDeltas,
    nextDeltaHeader,
} from "../adapters/db/postgres/tables/deltas.js";
import { requireJson } from "../middleware/json.js";
import { requireSession } from "../middleware/session.js";

const APPEND_TYPES = new Set(["history"]);

const deltas = new Hono();

deltas.get("/tip", requireSession, async (c) => {
    return c.json(await nextDeltaHeader(c.get("account").id));
});

deltas.get("/list", async (c) => {
    let address;
    try {
        address = getAddress(c.req.query("address") ?? "").toLowerCase();
    } catch {
        return c.json({ error: "invalid_request" }, 400);
    }
    const account = await findAccountByAddress(address);
    if (!account) {
        return c.json({ address, deltas: [] });
    }
    return c.json({ address, deltas: await listDeltas(account.id) });
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
                { error: "stale_tip", ...(await nextDeltaHeader(account.id)) },
                409,
            );
        }
        return c.json({ error: appended.error }, 400);
    }
    return c.json({ ok: true, seq: appended.row.seq });
});

export default deltas;
