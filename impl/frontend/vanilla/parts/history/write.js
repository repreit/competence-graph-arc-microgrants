import { signingBytes } from "impl/common/js/delta.js";
import { historyContent } from "impl/common/js/history.js";
import { provisionKey } from "../../adapters/key/provision.js";
import { sign } from "../../adapters/key/webcrypto/signer.js";
import { api } from "../../common/js/api.js";
import { state } from "../../common/js/store.js";

let pending = [];

async function appendHistory(ops) {
    const account = state.account;
    if (!account) {
        throw new Error("auth");
    }
    const record = await provisionKey(account.address);
    let nextDeltaHeader = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!nextDeltaHeader) {
            nextDeltaHeader = await api("/deltas/next-header");
        }
        const content = historyContent(record.publicKey, ops);
        const signature = await sign(
            record.privateKey,
            signingBytes({
                seq: nextDeltaHeader.seq,
                prev_hash: nextDeltaHeader.prev_hash,
                content,
            }),
        );
        try {
            return await api("/deltas/append", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    seq: nextDeltaHeader.seq,
                    prev_hash: nextDeltaHeader.prev_hash,
                    content,
                    signature,
                }),
            });
        } catch (err) {
            if (err.message !== "stale_tip") {
                throw err;
            }
            nextDeltaHeader = {
                seq: err.data.seq,
                prev_hash: err.data.prev_hash,
            };
        }
    }
    throw new Error("stale_tip");
}

export async function commit() {
    if (pending.length === 0) {
        return null;
    }
    const result = await appendHistory(pending);
    pending = [];
    return result;
}

export function pendingCount() {
    return pending.length;
}

export function pendingOps() {
    return pending.slice();
}

export function discard() {
    pending = [];
}

export function createNode({ title, link, img, alt, position }) {
    const data = { title, link };
    if (img != null) {
        data.img = img;
    }
    if (alt != null) {
        data.alt = alt;
    }
    const node = { id: crypto.randomUUID() };
    if (position != null) {
        node.position = position;
    }
    node.data = data;
    pending.push({ op: "node.create", node });
    return node.id;
}

export function setNode({ id, data, position }) {
    const node = { id };
    if (data !== undefined) {
        node.data = data;
    }
    if (position !== undefined) {
        node.position = position;
    }
    pending.push({ op: "node.set", node });
}

export function deleteNode(id) {
    pending.push({ op: "node.delete", id });
}

export function addLink(a, b) {
    pending.push({ op: "link.add", a, b });
}

export function removeLink(a, b) {
    pending.push({ op: "link.remove", a, b });
}
