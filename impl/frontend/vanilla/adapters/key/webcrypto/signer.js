import { base64UrlFromBytes } from "impl/common/js/a001.js";
import {
    KEY_PARAMS,
    SIGN_PARAMS,
    canonicalPublicKey,
} from "impl/common/js/attest.js";

function subtleOrThrow() {
    if (!globalThis.crypto || !globalThis.crypto.subtle) {
        throw new Error("subtle");
    }
    return globalThis.crypto.subtle;
}

export async function generate() {
    const subtle = subtleOrThrow();
    const pair = await subtle.generateKey(KEY_PARAMS, false, [
        "sign",
        "verify",
    ]);
    const jwk = await subtle.exportKey("jwk", pair.publicKey);
    const canonical = canonicalPublicKey(jwk);
    if (canonical == null) {
        throw new Error("key");
    }
    return { privateKey: pair.privateKey, publicKey: JSON.parse(canonical) };
}

export async function sign(privateKey, bytes) {
    const subtle = subtleOrThrow();
    const signature = await subtle.sign(SIGN_PARAMS, privateKey, bytes);
    return base64UrlFromBytes(signature);
}
