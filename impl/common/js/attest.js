import { isNonEmptyString, isPlainObject } from "./a001.js";
import { parseContent } from "./delta.js";

const JWK_FIELDS = ["kty", "crv", "x", "y"];

export function canonicalPublicKey(publicKey) {
    if (!isPlainObject(publicKey)) {
        return null;
    }
    const incomplete = JWK_FIELDS.some(function (field) {
        return typeof publicKey[field] !== "string";
    });
    if (incomplete) {
        return null;
    }
    return JSON.stringify({
        kty: publicKey.kty,
        crv: publicKey.crv,
        x: publicKey.x,
        y: publicKey.y,
    });
}

function canonicalJwk(publicKey) {
    const key = canonicalPublicKey(publicKey);
    return key == null ? null : JSON.parse(key);
}

function parseAttestation(value) {
    if (!isPlainObject(value)) {
        return null;
    }
    if (!isNonEmptyString(value.address)) {
        return null;
    }
    if (!isNonEmptyString(value.signature)) {
        return null;
    }
    return { address: value.address, signature: value.signature };
}

function requireAttestation(value) {
    const attestation = parseAttestation(value);
    if (attestation == null) {
        throw new TypeError("attest");
    }
    return attestation;
}

function requireCanonicalKey(publicKey) {
    const key = canonicalPublicKey(publicKey);
    if (key == null) {
        throw new TypeError("attest");
    }
    return key;
}

export function bindMessage(address, publicKey) {
    if (typeof address !== "string") {
        throw new TypeError("attest");
    }
    return `Bind key for ${address}\n${requireCanonicalKey(publicKey)}`;
}

export function unbindMessage(address, bindingId, publicKey) {
    if (typeof address !== "string") {
        throw new TypeError("attest");
    }
    if (!Number.isSafeInteger(bindingId) || bindingId < 1) {
        throw new TypeError("attest");
    }
    return `Unbind key for ${address}\nBinding: ${bindingId}\n${requireCanonicalKey(publicKey)}`;
}

export function bindContent(publicKey, attestation) {
    const key = canonicalJwk(publicKey);
    if (key == null) {
        throw new TypeError("attest");
    }
    return JSON.stringify({
        type: "bind",
        publicKey: key,
        attestation: requireAttestation(attestation),
    });
}

export function unbindContent(bindingId, publicKey, attestation) {
    const key = canonicalJwk(publicKey);
    if (key == null) {
        throw new TypeError("attest");
    }
    if (!Number.isSafeInteger(bindingId) || bindingId < 1) {
        throw new TypeError("attest");
    }
    return JSON.stringify({
        type: "unbind",
        bindingId: bindingId,
        publicKey: key,
        attestation: requireAttestation(attestation),
    });
}

function readKeyAndAttestation(parsed) {
    const attestation = parseAttestation(parsed.attestation);
    if (attestation == null) {
        return null;
    }
    if (canonicalPublicKey(parsed.publicKey) == null) {
        return null;
    }
    return { publicKey: parsed.publicKey, attestation: attestation };
}

export function parseBindContent(content) {
    const parsed = parseContent(content);
    if (parsed == null || parsed.type !== "bind") {
        return null;
    }
    return readKeyAndAttestation(parsed);
}

export function parseUnbindContent(content) {
    const parsed = parseContent(content);
    if (parsed == null || parsed.type !== "unbind") {
        return null;
    }
    if (!Number.isSafeInteger(parsed.bindingId) || parsed.bindingId < 1) {
        return null;
    }
    const pair = readKeyAndAttestation(parsed);
    if (pair == null) {
        return null;
    }
    return {
        bindingId: parsed.bindingId,
        publicKey: pair.publicKey,
        attestation: pair.attestation,
    };
}
