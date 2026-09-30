import { isNonEmptyString, isPlainObject, isPositiveSafeInt } from "./a001.js";
import { parseContent } from "./delta.js";

export const KEY_TYPE = Object.freeze({ kty: "EC", crv: "P-256" });

export const KEY_PARAMS = Object.freeze({
    name: "ECDSA",
    namedCurve: KEY_TYPE.crv,
});

export const SIGN_PARAMS = Object.freeze({ name: "ECDSA", hash: "SHA-256" });

const COORDINATE_BYTES = 32;
const COORDINATE_CHARS = Math.ceil((COORDINATE_BYTES * 4) / 3);
const COORDINATE_PATTERN = new RegExp(
    "^[A-Za-z0-9_-]{" + COORDINATE_CHARS + "}$",
);

function isCoordinate(value) {
    return typeof value === "string" && COORDINATE_PATTERN.test(value);
}

export function canonicalPublicKey(publicKey) {
    if (!isPlainObject(publicKey)) {
        return null;
    }
    if (publicKey.kty !== KEY_TYPE.kty || publicKey.crv !== KEY_TYPE.crv) {
        return null;
    }
    if (!isCoordinate(publicKey.x) || !isCoordinate(publicKey.y)) {
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
    if (!isPositiveSafeInt(bindingId)) {
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
    if (!isPositiveSafeInt(bindingId)) {
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
    if (!isPositiveSafeInt(parsed.bindingId)) {
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
