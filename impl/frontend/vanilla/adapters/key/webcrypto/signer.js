import { base64UrlFromBytes } from "../../../impl/common/js/a001.js";
import { canonicalPublicKey } from "../../../impl/common/js/attest.js";

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" };
const SIGNING = { name: "ECDSA", hash: "SHA-256" };

function subtleOrThrow() {
    if (!globalThis.crypto || !globalThis.crypto.subtle) {
        throw new Error("subtle");
    }
    return globalThis.crypto.subtle;
}

export async function generate() {
    const subtle = subtleOrThrow();
    const pair = await subtle.generateKey(ALGORITHM, false, ["sign", "verify"]);
    const jwk = await subtle.exportKey("jwk", pair.publicKey);
    const canonical = canonicalPublicKey(jwk);
    if (canonical == null) {
        throw new Error("key");
    }
    return { privateKey: pair.privateKey, publicKeyJwk: JSON.parse(canonical) };
}

export async function sign(privateKey, bytes) {
    const subtle = subtleOrThrow();
    const signature = await subtle.sign(SIGNING, privateKey, bytes);
    return base64UrlFromBytes(new Uint8Array(signature));
}
