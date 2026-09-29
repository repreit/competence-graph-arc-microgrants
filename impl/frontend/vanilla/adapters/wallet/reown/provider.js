const USER_REJECTED = 4001;

function hasRequest(provider) {
    return Boolean(provider) && typeof provider.request === "function";
}

export function getProvider(modal) {
    if (hasRequest(window.ethereum)) {
        return window.ethereum;
    }
    const fromAppKit =
        (typeof modal.getProvider === "function" &&
            modal.getProvider("eip155")) ||
        (typeof modal.getWalletProvider === "function" &&
            modal.getWalletProvider());
    if (hasRequest(fromAppKit)) {
        return fromAppKit;
    }
    return null;
}

async function addressFromProvider(provider) {
    if (!provider) {
        return "";
    }
    const accounts = await provider.request({ method: "eth_accounts" });
    return Array.isArray(accounts) && accounts[0] ? accounts[0] : "";
}

export async function readAddress(modal) {
    try {
        const live = await addressFromProvider(getProvider(modal));
        if (live) {
            return live;
        }
    } catch {}
    if (typeof modal.getAddress === "function") {
        const address = modal.getAddress();
        if (address) {
            return address;
        }
    }
    return "";
}

export async function signMessage(modal, message, address) {
    const provider = getProvider(modal);
    if (!provider) {
        throw new Error("wallet");
    }
    return provider.request({
        method: "personal_sign",
        params: [hexFromUtf8(message), address],
    });
}

function hexFromUtf8(text) {
    const bytes = new TextEncoder().encode(text);
    let out = "0x";
    for (let i = 0; i < bytes.length; i += 1) {
        out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
}

export function isUserRejected(err) {
    return err?.code === USER_REJECTED;
}
