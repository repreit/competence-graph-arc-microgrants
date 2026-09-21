const USER_REJECTED = 4001;

function hasRequest(provider) {
    return Boolean(provider) && typeof provider.request === "function";
}

/** AppKit provider, else injected MetaMask. */
export function getProvider(modal) {
    const fromAppKit =
        (typeof modal.getWalletProvider === "function" &&
            modal.getWalletProvider()) ||
        (typeof modal.getProviders === "function" &&
            modal.getProviders()?.eip155);
    if (hasRequest(fromAppKit)) {
        return fromAppKit;
    }
    if (hasRequest(window.ethereum)) {
        return window.ethereum;
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

/** AppKit getAddress, else eth_accounts via provider. */
export async function readAddress(modal) {
    if (typeof modal.getAddress === "function") {
        const address = modal.getAddress();
        if (address) {
            return address;
        }
    }
    return addressFromProvider(getProvider(modal));
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
