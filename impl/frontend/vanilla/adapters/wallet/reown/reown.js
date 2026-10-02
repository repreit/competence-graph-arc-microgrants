export async function openModal() {
    const { getModal } = await import("./modal.js");
    const modal = await getModal();
    modal.open({ view: "Connect" });
}

export async function disconnectWallet() {
    const { getModal } = await import("./modal.js");
    const modal = await getModal();
    await modal.disconnect();
}

export async function signMessage(message) {
    const { getModal } = await import("./modal.js");
    const modal = await getModal();
    const provider = modal.getProvider("eip155");
    if (!provider) {
        throw new Error("wallet");
    }
    const { BrowserProvider } = await import("ethers");
    const signer = await new BrowserProvider(provider).getSigner();
    return await signer.signMessage(message);
}
