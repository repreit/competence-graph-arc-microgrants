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
