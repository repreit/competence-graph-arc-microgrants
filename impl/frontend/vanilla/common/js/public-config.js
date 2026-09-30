import { apiBase } from "./a001.js";
import { emit } from "./store.js";

let pending = null;

async function load() {
    const base = apiBase();
    if (!base) {
        throw new Error("api");
    }
    let response;
    try {
        response = await fetch(base + "/public-config");
    } catch (err) {
        throw new Error("http", { cause: err });
    }
    if (!response.ok) {
        throw new Error("http");
    }
    const data = await response.json().catch(function () {
        return {};
    });
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
