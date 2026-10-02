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

function hasActiveBinding(record, bindings) {
    const keyText = canonicalPublicKey(record.publicKeyJwk);
    return bindings.some(function (binding) {
        return (
            binding.unbindSeq == null &&
            canonicalPublicKey(binding.publicKey) === keyText
        );
    });
}

export async function ensureKey(address) {
    const { bindings } = await api("/bindings/list");
    const record = await load(address);
    if (record && hasActiveBinding(record, bindings)) {
        return record;
    }
    if (record) {
        await remove(address);
    }
    const key = await generate();
    return await save({
        address: address,
        publicKeyJwk: key.publicKeyJwk,
        privateKey: key.privateKey,
    });
}

export async function bindKey(address, record) {
    const tip = await api("/deltas/tip");
    const attestation = {
        address: address,
        signature: await signMessage(bindMessage(address, record.publicKeyJwk)),
    };
    const content = bindContent(record.publicKeyJwk, attestation);
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
