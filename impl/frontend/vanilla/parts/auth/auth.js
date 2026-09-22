import {
    requestAccount,
    switchChain,
    signMessage,
    hostChainId,
} from "../../adapters/wallet/reown/reown.js";
import { isUserRejected } from "../../adapters/wallet/reown/provider.js";
import { shortAddress, apiBase, pageUri } from "../../common/js/a001.js";
import { emit, on, state } from "../../common/js/store.js";

const TOKEN_KEY = "competence-graph.session-token";

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(value) {
    if (value) {
        localStorage.setItem(TOKEN_KEY, value);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

function siweMessage({ domain, address, uri, chainId, nonce }) {
    return (
        domain +
        " wants you to sign in with your Ethereum account:\n" +
        address +
        "\n\nURI: " +
        uri +
        "\nVersion: 1\nChain ID: " +
        chainId +
        "\nNonce: " +
        nonce +
        "\nIssued At: " +
        new Date().toISOString()
    );
}

async function api(path, options) {
    const base = apiBase();
    if (!base) {
        throw new Error("api");
    }
    const headers = Object.assign({}, options && options.headers);
    const session = getToken();
    if (session) {
        headers.Authorization = "Bearer " + session;
    }
    let response;
    try {
        response = await fetch(
            base + path,
            Object.assign({}, options, { headers }),
        );
    } catch (err) {
        throw new Error("http", { cause: err });
    }
    const data = await response.json().catch(function () {
        return {};
    });
    if (!response.ok) {
        const error = new Error(data.error || "http");
        error.status = response.status;
        throw error;
    }
    return data;
}

// TODO: review AppKit SIWE / One-Click Auth
async function signIn() {
    emit("signInStarted", { authPending: true, authError: "" });
    try {
        const address = await requestAccount();
        const { nonce } = await api("/auth/nonce");
        const chainId = await hostChainId();
        await switchChain();
        const message = siweMessage({
            domain: location.host,
            address: address,
            uri: pageUri(),
            chainId: chainId,
            nonce: nonce,
        });
        const signature = await signMessage(message, address);
        const result = await api("/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message, signature: signature }),
        });
        setToken(result.token);
        emit("signedIn", {
            account: { id: result.id, address: result.address },
            authPending: false,
        });
        return result;
    } catch (err) {
        emit("authFailed", {
            authPending: false,
            authError: errorText(err),
        });
        return null;
    }
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
    if (err.message === "wallet") {
        return "Connect a wallet to continue.";
    }
    if (err.message === "reown") {
        return "No Reown project id. Set REOWN_PROJECT_ID on the API.";
    }
    if (err.message === "chain") {
        return "Switch the wallet to this host's chain, then try again.";
    }
    if (err.message === "api") {
        return "No API host. Serve locally, or pass ?api=";
    }
    if (err.message === "http") {
        return "Could not reach the API.";
    }
    if (isUserRejected(err)) {
        return "Request was rejected.";
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
