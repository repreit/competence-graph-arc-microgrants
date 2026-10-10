import { randomBytes } from "node:crypto";
import { hashBytes } from "../../../../../../common/js/a001.js";

const maxAge = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

export function createSessionToken() {
    return randomBytes(32).toString("base64url");
}

export async function hashSessionToken(sessionToken) {
    return hashBytes(encoder.encode(sessionToken));
}

export function sessionExpiresAt() {
    return new Date(Date.now() + maxAge * 1000);
}
