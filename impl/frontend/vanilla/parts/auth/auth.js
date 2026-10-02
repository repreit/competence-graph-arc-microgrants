import {
    openModal,
    disconnectWallet,
} from "../../adapters/wallet/reown/reown.js";
import { api } from "../../common/js/api.js";
import { shortAddress } from "../../common/js/a001.js";
import { getToken, setToken } from "../../common/js/session.js";
import { emit, on, state } from "../../common/js/store.js";
import { lang } from "../../common/js/lang.js";

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
        return lang.SIGN_IN_FAILED;
    }
    if (err.message === "reown") {
        return lang.NO_PROJECT_ID;
    }
    if (err.message === "chain") {
        return lang.HOST_CHAIN_UNUSABLE;
    }
    if (err.message === "api") {
        return lang.NO_API_BASE;
    }
    if (err.message === "http") {
        return lang.API_UNREACHABLE;
    }
    return lang.SIGN_IN_FAILED;
}

export function bindAuth() {
    const signInEl = document.getElementById("sign-in");
    const signOutEl = document.getElementById("sign-out");
    const addressEl = document.getElementById("account-address");
    const statusEl = document.getElementById("auth-status");
    if (!signInEl || !signOutEl || !addressEl || !statusEl) {
        return;
    }
    signInEl.textContent = lang.SIGN_IN;
    signOutEl.textContent = lang.SIGN_OUT;

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
                    authError: lang.SIGN_OUT_FAILED,
                });
            })
            .finally(function () {
                signOutEl.disabled = false;
            });
    });

    render(state);
    restore();
}
