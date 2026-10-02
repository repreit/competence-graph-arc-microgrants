import { emit, state } from "../../../common/js/store.js";

let modalCloseWatch;

function watchModalClose(modal) {
    if (modalCloseWatch) {
        return;
    }
    let opened = false;
    modalCloseWatch = modal.subscribeState(function (nextState) {
        if (nextState.open) {
            opened = true;
            return;
        }
        if (!opened) {
            return;
        }
        opened = false;
        if (state.authPending) {
            emit("authCancelled", { authPending: false, authError: "" });
        }
    });
}

export async function openModal() {
    const { getModal } = await import("./modal.js");
    const modal = await getModal();
    watchModalClose(modal);
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
