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
