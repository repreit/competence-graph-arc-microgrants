import { signingBytes } from "impl/common/js/delta.js";
import { historyContent } from "impl/common/js/history.js";
import { provisionKey } from "../../adapters/key/provision.js";
import { sign } from "../../adapters/key/webcrypto/signer.js";
import { api } from "../../common/js/api.js";
import { state } from "../../common/js/store.js";

let pending = [];

export async function appendHistory(ops) {
    const account = state.account;
    if (!account) {
        throw new Error("auth");
    }
    const record = await provisionKey(account.address);
    let next = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const tip = next ?? (await api("/deltas/tip"));
        const content = historyContent(record.publicKey, ops);
        const signature = await sign(
            record.privateKey,
            signingBytes({
                seq: tip.seq,
                prev_hash: tip.prev_hash,
                content,
            }),
        );
        try {
            return await api("/deltas/append", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    seq: tip.seq,
                    prev_hash: tip.prev_hash,
                    content,
                    signature,
                }),
            });
        } catch (err) {
            if (err.message !== "stale_tip") {
                throw err;
            }
            next = { seq: err.data.seq, prev_hash: err.data.prev_hash };
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

export function createNode({ title, link, img, alt, position }) {
    const data = { title, link };
    if (img != null) {
        data.img = img;
    }
    if (alt != null) {
        data.alt = alt;
    }
    const node = { id: crypto.randomUUID(), data };
    if (position != null) {
        node.position = position;
    }
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
