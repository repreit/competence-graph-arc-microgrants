import { api } from "./config.js";

export function apiBase() {
    const query = new URLSearchParams(location.search).get("api");
    if (query) {
        return query.replace(/\/$/, "");
    }
    if (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
    ) {
        return "http://127.0.0.1:3000";
    }
    return api.base;
}
