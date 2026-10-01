import { getModal } from "./modal.js";

export async function openModal() {
    const modal = await getModal();
    modal.open({ view: "Connect" });
}

export async function disconnectWallet() {
    const modal = await getModal();
    await modal.disconnect();
}
