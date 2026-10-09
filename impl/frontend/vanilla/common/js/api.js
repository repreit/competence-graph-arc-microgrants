import { api as apiConfig } from "../../config.js";
import { getToken } from "./session.js";

function apiBase() {
    if (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
    ) {
        return apiConfig.local;
    }
    return apiConfig.base;
}

export async function api(path, options) {
    const { auth = true, ...rest } = options ?? {};
    const headers = Object.assign({}, rest.headers);
    const session = auth ? getToken() : null;
    if (session) {
        headers.Authorization = "Bearer " + session;
    }
    const base = apiBase();
    if (!base) {
        throw new Error("api");
    }
    let response;
    try {
        response = await fetch(
            base + path,
            Object.assign({}, rest, { headers }),
        );
    } catch (err) {
        throw new Error("http", { cause: err });
    }
    const data = await response.json().catch(function () {
        return {};
    });
    if (!response.ok) {
        const error = new Error(data.error ?? "http");
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}
