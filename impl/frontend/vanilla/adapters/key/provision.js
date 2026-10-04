import { bindContent, bindMessage } from "impl/common/js/attest.js";
import { signingBytes } from "impl/common/js/delta.js";
import { api } from "../../common/js/api.js";
import { signMessage } from "../wallet/reown/reown.js";
import { load, remove, save } from "./indexeddb/store.js";
import { generate, sign } from "./webcrypto/signer.js";

export async function findActiveKey(address) {
    const record = await load(address);
    if (!record) {
        return null;
    }
    const { active } = await api("/bindings/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: record.publicKey }),
    });
    return active ? record : null;
}

export async function provisionKey(address) {
    const record = await findActiveKey(address);
    if (record) {
        return record;
    }
    await remove(address);
    const key = await generate();
    const saved = await save({
        address,
        publicKey: key.publicKey,
        privateKey: key.privateKey,
    });
    try {
        await bindKey(address, saved);
    } catch (err) {
        await remove(address).catch(function () {});
        throw err;
    }
    return saved;
}

async function bindKey(address, record) {
    const nextDeltaHeader = await api("/deltas/next-header");
    const attestation = {
        address,
        signature: await signMessage(bindMessage(address, record.publicKey)),
    };
    const content = bindContent(record.publicKey, attestation);
    const signature = await sign(
        record.privateKey,
        signingBytes({
            seq: nextDeltaHeader.seq,
            prev_hash: nextDeltaHeader.prev_hash,
            content,
        }),
    );
    return await api("/bindings/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            seq: nextDeltaHeader.seq,
            prev_hash: nextDeltaHeader.prev_hash,
            content,
            signature,
        }),
    });
}
