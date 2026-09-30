import { Hono } from "hono";
import {
    verifyBindAttestation,
    verifyUnbindAttestation,
} from "../adapters/auth/attestation/verify.js";
import { isPositiveSafeInt } from "../../../../common/js/a001.js";
import {
    canonicalPublicKey,
    parseBindContent,
    parseUnbindContent,
} from "../../../../common/js/attest.js";
import { parseDelta } from "../../../../common/js/delta.js";
import { verifyDeltaSignature } from "../../../../common/js/verify.js";
import {
    bindKey,
    findActiveBinding,
    listBindings,
    unbindKey,
} from "../adapters/db/postgres/tables/bindings.js";
import { nextLink } from "../adapters/db/postgres/tables/deltas.js";
import { requireJson } from "../middleware/json.js";
import { requireSession } from "../middleware/session.js";

const bindings = new Hono();

function attestationBelongsTo(attestation, account) {
    return attestation.address.toLowerCase() === account.address.toLowerCase();
}

function errorStatus(error) {
    return error === "signature" ? 401 : 400;
}

bindings.get("/list", requireSession, async (c) => {
    return c.json({ bindings: await listBindings(c.get("account").id) });
});

bindings.post("/bind", requireSession, requireJson, async (c) => {
    const account = c.get("account");
    const delta = parseDelta(c.get("body"));
    if (!delta) {
        return c.json({ error: "invalid_request" }, 400);
    }
    const parsed = parseBindContent(delta.content);
    if (!parsed) {
        return c.json({ error: "invalid_request" }, 400);
    }
    if (!attestationBelongsTo(parsed.attestation, account)) {
        return c.json({ error: "signature" }, 401);
    }
    const verified = await verifyBindAttestation({
        address: account.address,
        publicKey: parsed.publicKey,
        signature: parsed.attestation.signature,
    });
    if (!verified.ok) {
        return c.json({ error: verified.error }, errorStatus(verified.error));
    }
    const signed = await verifyDeltaSignature(
        parsed.publicKey,
        delta,
        delta.signature,
    );
    if (!signed) {
        return c.json({ error: "signature" }, 401);
    }
    const result = await bindKey(account.id, delta);
    if (!result.ok) {
        if (result.error === "stale_tip") {
            return c.json(
                { error: "stale_tip", ...(await nextLink(account.id)) },
                409,
            );
        }
        return c.json(
            { error: result.error },
            result.error === "invalid" ? 400 : 409,
        );
    }
    return c.json({ ok: true, seq: result.seq });
});

bindings.post("/:id/unbind", requireSession, requireJson, async (c) => {
    const account = c.get("account");
    const bindingId = Number(c.req.param("id"));
    if (!isPositiveSafeInt(bindingId)) {
        return c.json({ error: "invalid_request" }, 400);
    }
    const delta = parseDelta(c.get("body"));
    if (!delta) {
        return c.json({ error: "invalid_request" }, 400);
    }
    const parsed = parseUnbindContent(delta.content);
    if (!parsed || parsed.bindingId !== bindingId) {
        return c.json({ error: "invalid_request" }, 400);
    }
    if (!attestationBelongsTo(parsed.attestation, account)) {
        return c.json({ error: "signature" }, 401);
    }
    const binding = await findActiveBinding(account.id, bindingId);
    if (!binding) {
        return c.json({ error: "not_found" }, 404);
    }
    if (binding.public_key !== canonicalPublicKey(parsed.publicKey)) {
        return c.json({ error: "invalid_request" }, 400);
    }
    const verified = await verifyUnbindAttestation({
        address: account.address,
        bindingId: bindingId,
        publicKey: parsed.publicKey,
        signature: parsed.attestation.signature,
    });
    if (!verified.ok) {
        return c.json({ error: verified.error }, errorStatus(verified.error));
    }
    // Intentional: unbind deltas are unsigned (lost-key path)
    const result = await unbindKey(account.id, bindingId, delta);
    if (!result.ok) {
        if (result.error === "stale_tip") {
            return c.json(
                { error: "stale_tip", ...(await nextLink(account.id)) },
                409,
            );
        }
        return c.json(
            { error: result.error },
            result.error === "not_found" ? 404 : 409,
        );
    }
    return c.json({ ok: true, seq: result.seq });
});

export default bindings;
