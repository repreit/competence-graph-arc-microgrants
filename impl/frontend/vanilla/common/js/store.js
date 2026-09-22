export let state = Object.freeze({
    account: null,
    authPending: false,
    authError: "",
});

const listeners = new Map();

export function emit(name, patch) {
    state = Object.freeze(Object.assign({}, state, patch));
    const group = listeners.get(name);
    if (!group) {
        return;
    }
    group.forEach(function (listener) {
        listener(state);
    });
}

export function on(name, listener) {
    if (!listeners.has(name)) {
        listeners.set(name, new Set());
    }
    listeners.get(name).add(listener);
    return function () {
        listeners.get(name).delete(listener);
    };
}
