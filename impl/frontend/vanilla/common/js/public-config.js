import { apiFetch } from "./api.js";
import { emit } from "./store.js";

let pending = null;

async function load() {
    const { response, data } = await apiFetch("/public-config");
    if (!response.ok) {
        throw new Error("http");
    }
    if (!data.app?.name) {
        throw new Error("api");
    }
    emit("publicConfigLoaded", { publicConfig: data });
    return data;
}

export function loadPublicConfig() {
    if (!pending) {
        pending = load().catch(function (err) {
            pending = null;
            throw err;
        });
    }
    return pending;
}
