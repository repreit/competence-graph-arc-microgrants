export let state = Object.freeze({
    account: null,
    authPending: false,
    authError: "",
    publicConfig: null,
});

const listeners = new Map();

export function emit(name, patch) {
    state = Object.freeze(Object.assign({}, state, patch));
    const group = listeners.get(name);
    if (!group) {
        return;
    }
    [...group].forEach(function (listener) {
        let result;
        try {
            result = listener(state);
        } catch (err) {
            console.error(name, err);
            return;
        }
        if (result && typeof result.then === "function") {
            console.error(name, "listener must be synchronous, got a promise");
            result.catch(function (err) {
                console.error(name, err);
            });
        }
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
