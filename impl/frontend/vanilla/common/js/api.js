import { api as apiConfig } from "../../config.js";

function apiBase() {
    if (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
    ) {
        return apiConfig.local;
    }
    return apiConfig.base;
}

export async function apiFetch(path, options) {
    const base = apiBase();
    if (!base) {
        throw new Error("api");
    }
    let response;
    try {
        response = await fetch(base + path, options);
    } catch (err) {
        throw new Error("http", { cause: err });
    }
    const data = await response.json().catch(function () {
        return {};
    });
    return { response: response, data: data };
}
