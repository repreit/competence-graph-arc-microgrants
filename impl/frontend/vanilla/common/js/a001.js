export function shortAddress(address) {
    if (!address) {
        return "";
    }
    if (address.length < 12) {
        return address;
    }
    return address.slice(0, 6) + "…" + address.slice(-4);
}

export function pageUri() {
    return location.origin + location.pathname.replace(/\/+$/, "");
}

export function safeUrl(value) {
    if (typeof value !== "string") {
        return "";
    }
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
        return "";
    }
}
