import { api } from "../../config.js";

export function shortAddress(address) {
    if (!address) {
        return "";
    }
    if (address.length < 12) {
        return address;
    }
    return address.slice(0, 6) + "…" + address.slice(-4);
}

export function apiBase() {
    if (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
    ) {
        return api.local;
    }
    return api.base;
}

export function pageUri() {
    return location.origin + location.pathname.replace(/\/+$/, "");
}
