import {
    requestAccount,
    switchChain,
    signMessage,
    hostChainId,
} from "../../adapters/wallet/reown/reown.js";
import { isUserRejected } from "../../adapters/wallet/reown/provider.js";
import { shortAddress, apiBase, pageUri } from "../../common/js/a001.js";

const TOKEN_KEY = "competence-graph.session-token";

function token() {
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
    const session = token();
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
    const address = await requestAccount();
    const issued = await api("/auth/nonce");
    const chainId = await hostChainId();
    await switchChain();
    const message = siweMessage({
        domain: location.host,
        address: address,
        uri: pageUri(),
        chainId: chainId,
        nonce: issued.nonce,
    });
    const signature = await signMessage(message, address);
    const result = await api("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message, signature: signature }),
    });
    setToken(result.token);
    return result;
}

async function restore() {
    if (!token()) {
        return null;
    }
    try {
        return await api("/auth/me");
    } catch (err) {
        if (err.status === 401) {
            setToken("");
            return null;
        }
        throw err;
    }
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

    function showStatus(text) {
        statusEl.hidden = !text;
        statusEl.textContent = text || "";
    }

    function showSignedOut() {
        signInEl.hidden = false;
        signOutEl.hidden = true;
        addressEl.hidden = true;
        addressEl.textContent = "";
        addressEl.removeAttribute("title");
    }

    function showSignedIn(account) {
        signInEl.hidden = true;
        signOutEl.hidden = false;
        addressEl.hidden = false;
        addressEl.textContent = shortAddress(account.address);
        addressEl.title = account.address;
        showStatus("");
    }

    signInEl.addEventListener("click", function () {
        signInEl.disabled = true;
        showStatus("");
        signIn()
            .then(showSignedIn)
            .catch(function (err) {
                showStatus(errorText(err));
            })
            .finally(function () {
                signInEl.disabled = false;
            });
    });

    signOutEl.addEventListener("click", function () {
        signOutEl.disabled = true;
        signOut()
            .then(function () {
                showSignedOut();
                showStatus("");
            })
            .catch(function () {
                showStatus("Could not sign out.");
            })
            .finally(function () {
                signOutEl.disabled = false;
            });
    });

    restore()
        .then(function (account) {
            if (account) {
                showSignedIn(account);
            }
        })
        .catch(function (err) {
            showStatus(errorText(err));
        });
}
