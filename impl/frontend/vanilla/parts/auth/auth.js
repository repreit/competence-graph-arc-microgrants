import {
    openModal,
    disconnectWallet,
} from "../../adapters/wallet/reown/reown.js";
import { shortAddress, apiFetch } from "../../common/js/a001.js";
import { getToken, setToken } from "../../common/js/session.js";
import { emit, on, state } from "../../common/js/store.js";

async function api(path, options) {
    const headers = Object.assign({}, options && options.headers);
    const session = getToken();
    if (session) {
        headers.Authorization = "Bearer " + session;
    }
    const { response, data } = await apiFetch(
        path,
        Object.assign({}, options, { headers }),
    );
    if (!response.ok) {
        const error = new Error(data.error || "http");
        error.status = response.status;
        throw error;
    }
    return data;
}

// TODO: review One-Click Auth
function signIn() {
    openModal().catch(function (err) {
        emit("authFailed", {
            authPending: false,
            authError: errorText(err),
        });
    });
}

function restore() {
    if (!getToken()) {
        emit("signedOut", { account: null, authPending: false, authError: "" });
        return Promise.resolve(null);
    }
    emit("signInStarted", { authPending: true, authError: "" });
    return api("/auth/me")
        .then(function (account) {
            emit("signedIn", { account: account, authPending: false });
            return account;
        })
        .catch(function (err) {
            if (err.status === 401) {
                setToken("");
                emit("signedOut", {
                    account: null,
                    authPending: false,
                    authError: "",
                });
                return null;
            }
            emit("authFailed", {
                authPending: false,
                authError: errorText(err),
            });
            return null;
        });
}

async function signOut() {
    try {
        await disconnectWallet();
    } catch {}
    try {
        await api("/auth/logout", { method: "POST" });
    } catch (err) {
        if (err.status !== 401) {
            throw err;
        }
    }
    setToken("");
    emit("signedOut", { account: null, authPending: false, authError: "" });
}

function errorText(err) {
    if (!err) {
        return "Could not sign in.";
    }
    if (err.message === "reown") {
        return "The API has no Reown project id.";
    }
    if (err.message === "chain") {
        return "The API host chain is not usable.";
    }
    if (err.message === "api") {
        return "No API base. Check config.js.";
    }
    if (err.message === "http") {
        return "Could not reach the API.";
    }
    return "Could not sign in.";
}

export function bindAuth() {
    const signInEl = document.getElementById("sign-in");
    const signOutEl = document.getElementById("sign-out");
    const addressEl = document.getElementById("account-address");
    const statusEl = document.getElementById("auth-status");
    if (!signInEl || !signOutEl || !addressEl || !statusEl) {
        return;
    }

    function render(nextState) {
        const account = nextState.account;
        signInEl.hidden = Boolean(account);
        signInEl.disabled = nextState.authPending;
        signOutEl.hidden = !account;
        addressEl.hidden = !account;
        addressEl.textContent = account ? shortAddress(account.address) : "";
        if (account) {
            addressEl.title = account.address;
        } else {
            addressEl.removeAttribute("title");
        }
        statusEl.hidden = !nextState.authError;
        statusEl.textContent = nextState.authError || "";
    }

    ["signInStarted", "signedIn", "signedOut", "authFailed"].forEach(
        function (name) {
            on(name, render);
        },
    );

    signInEl.addEventListener("click", function () {
        signIn();
    });

    signOutEl.addEventListener("click", function () {
        signOutEl.disabled = true;
        signOut()
            .catch(function () {
                emit("authFailed", {
                    authPending: false,
                    authError: "Could not sign out.",
                });
            })
            .finally(function () {
                signOutEl.disabled = false;
            });
    });

    render(state);
    restore();
}
