/** AppKit provider, else injected MetaMask. */
export function walletProvider(modal) {
    const fromAppKit =
        (typeof modal.getWalletProvider === "function" &&
            modal.getWalletProvider()) ||
        (typeof modal.getProviders === "function" &&
            modal.getProviders()?.eip155);
    if (fromAppKit && typeof fromAppKit.request === "function") {
        return fromAppKit;
    }
    if (window.ethereum && typeof window.ethereum.request === "function") {
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
    return addressFromProvider(walletProvider(modal));
}

export async function signMessage(modal, message, address) {
    const provider = walletProvider(modal);
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
    return Boolean(err && err.code === 4001);
}
