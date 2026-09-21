import { requestAccount as requestAccountFromModal } from "./account.js";
import { switchChain as switchHostChain } from "./chain.js";
import { getHostNetwork, getModal } from "./modal.js";
import { signMessage as signWithProvider } from "./provider.js";

export async function requestAccount() {
    return requestAccountFromModal(await getModal());
}

export async function hostChainId() {
    await getModal();
    const network = getHostNetwork();
    if (!network) {
        throw new Error("chain");
    }
    return Number(network.id);
}

export async function switchChain() {
    await switchHostChain(await getModal(), getHostNetwork());
}

export async function signMessage(message, address) {
    return signWithProvider(await getModal(), message, address);
}
