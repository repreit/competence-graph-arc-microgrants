import { state } from "./store.js";

const KEY = "competence-graph.session-token";

export function getToken() {
    return localStorage.getItem(KEY);
}

export function setToken(value) {
    if (value) {
        localStorage.setItem(KEY, value);
    } else {
        localStorage.removeItem(KEY);
    }
}

export function isSessionAccount(account) {
    return Boolean(account && state.account?.address === account.address);
}
