import { signingBytes } from "./delta.js";

function base64UrlToBytes(value) {
    const padded =
        value.replace(/-/g, "+").replace(/_/g, "/") +
        "==".slice(0, (4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export async function verifyDeltaSignature(
    publicKey,
    { seq, prev_hash, content },
    signature,
) {
    if (typeof signature !== "string" || signature.length === 0) {
        return false;
    }
    try {
        const key = await crypto.subtle.importKey(
            "jwk",
            publicKey,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["verify"],
        );
        const data = signingBytes({ seq, prev_hash, content });
        const sig = base64UrlToBytes(signature);
        return await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            key,
            sig,
            data,
        );
    } catch {
        return false;
    }
}
