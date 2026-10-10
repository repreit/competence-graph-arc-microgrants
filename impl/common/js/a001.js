export function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}

export function isPositiveSafeInt(value) {
    return Number.isSafeInteger(value) && value >= 1;
}

export function bytesFromBase64Url(value) {
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

export function base64UrlFromBytes(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function hexFromBytes(buffer) {
    const bytes = new Uint8Array(buffer);
    let out = "";
    for (const byte of bytes) {
        out += byte.toString(16).padStart(2, "0");
    }
    return out;
}
