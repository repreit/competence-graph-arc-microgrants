import { bindContent, bindMessage } from "../../../impl/common/js/attest.js";
import { signingBytes } from "../../../impl/common/js/delta.js";
import { api } from "../../common/js/api.js";
import { signMessage } from "../wallet/reown/reown.js";
import { sign } from "./webcrypto/signer.js";

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
