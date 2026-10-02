import {
    bindContent,
    bindMessage,
    canonicalPublicKey,
} from "../../../impl/common/js/attest.js";
import { signingBytes } from "../../../impl/common/js/delta.js";
import { api } from "../../common/js/api.js";
import { signMessage } from "../wallet/reown/reown.js";
import { load, remove, save } from "./indexeddb/store.js";
import { generate, sign } from "./webcrypto/signer.js";

export async function findActiveKey(address) {
    const record = await load(address);
    if (!record) {
        return null;
    }
    const keyText = canonicalPublicKey(record.publicKey);
    const { bindings } = await api("/bindings/list");
    const active = bindings.some(function (binding) {
        return (
            binding.unbindSeq == null &&
            canonicalPublicKey(binding.publicKey) === keyText
        );
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
        address: address,
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
    const tip = await api("/deltas/tip");
    const attestation = {
        address: address,
        signature: await signMessage(bindMessage(address, record.publicKey)),
    };
    const content = bindContent(record.publicKey, attestation);
    const signature = await sign(
        record.privateKey,
        signingBytes({
            seq: tip.seq,
            prev_hash: tip.prev_hash,
            content: content,
        }),
    );
    return await api("/bindings/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            seq: tip.seq,
            prev_hash: tip.prev_hash,
            content: content,
            signature: signature,
        }),
    });
}
