import { api } from "./api.js";
import { emit } from "./store.js";

let pending = null;

async function load() {
    let data;
    try {
        data = await api("/public-config", { auth: false });
    } catch (err) {
        throw new Error("http", { cause: err });
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
