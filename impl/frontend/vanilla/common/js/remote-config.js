import { api } from "./api.js";
import { emit } from "./store.js";

let pending = null;

async function load() {
    let data;
    try {
        data = await api("/remote-config/load", { auth: false });
    } catch (err) {
        throw new Error("http", { cause: err });
    }
    emit("remoteConfigLoaded", { remoteConfig: data });
    return data;
}

export function loadRemoteConfig() {
    if (!pending) {
        pending = load().catch(function (err) {
            pending = null;
            throw err;
        });
    }
    return pending;
}
