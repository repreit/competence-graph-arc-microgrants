import {
    hashBytes,
    isHash,
    isNonEmptyString,
    isPlainObject,
    isPositiveSafeInt,
} from "./a001.js";

const encoder = new TextEncoder();

export function isSeq(seq) {
    return isPositiveSafeInt(seq);
}

export function isPrevHash(prevHash) {
    return prevHash == null || isHash(prevHash);
}

function isDelta(row) {
    return (
        row != null &&
        typeof row.content === "string" &&
        isSeq(row.seq) &&
        isPrevHash(row.prev_hash)
    );
}

export async function hashRow({ seq, prev_hash, content, signature }) {
    if (signature != null && typeof signature !== "string") {
        throw new TypeError("signature");
    }
    const signing = signingBytes({ seq, prev_hash, content });
    const tail = encoder.encode(`\n${signature ?? ""}`);
    const bytes = new Uint8Array(signing.length + tail.length);
    bytes.set(signing, 0);
    bytes.set(tail, signing.length);
    return hashBytes(bytes);
}

export function signingBytes({ seq, prev_hash, content }) {
    if (!isSeq(seq) || !isPrevHash(prev_hash) || typeof content !== "string") {
        throw new TypeError("delta");
    }
    const prev = prev_hash == null ? "" : prev_hash;
    return encoder.encode(`${seq}\n${prev}\n${content}`);
}

export function parseContent(content) {
    if (typeof content !== "string") {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        return null;
    }
    if (!isPlainObject(parsed)) {
        return null;
    }
    if (!isNonEmptyString(parsed.type)) {
        return null;
    }
    if (!isPlainObject(parsed.publicKey)) {
        return null;
    }
    return parsed;
}

export function parseDelta(body) {
    if (!isPlainObject(body)) {
        return null;
    }
    const content = body.content;
    const signature = body.signature;
    const seq = body.seq;
    const prev_hash = body.prev_hash ?? null;
    if (typeof content !== "string") {
        return null;
    }
    if (signature != null && typeof signature !== "string") {
        return null;
    }
    if (!isSeq(seq) || !isPrevHash(prev_hash)) {
        return null;
    }
    return { seq, prev_hash, content, signature: signature ?? null };
}

export async function assertChain(prev, next) {
    if (!isDelta(next)) {
        return { ok: false, error: "invalid" };
    }
    if (prev == null) {
        if (next.seq !== 1) {
            return { ok: false, error: "seq" };
        }
        if (next.prev_hash != null) {
            return { ok: false, error: "prev_hash" };
        }
        return { ok: true };
    }
    if (!isDelta(prev)) {
        return { ok: false, error: "invalid" };
    }
    if (next.seq !== prev.seq + 1) {
        return { ok: false, error: "seq" };
    }
    const expected = await hashRow(prev);
    if (next.prev_hash !== expected) {
        return { ok: false, error: "prev_hash" };
    }
    return { ok: true };
}
