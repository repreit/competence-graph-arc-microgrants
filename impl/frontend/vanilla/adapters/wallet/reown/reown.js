import * as account from "./account.js";
import * as chain from "./chain.js";
import { getHostNetwork, getModal } from "./modal.js";
import * as provider from "./provider.js";

export async function requestAccount() {
    return account.requestAccount(await getModal());
}

export async function hostChainId() {
    await getModal();
    return Number(getHostNetwork().id);
}

export async function switchChain() {
    await chain.switchChain(await getModal(), getHostNetwork());
}

export async function signMessage(message, address) {
    return provider.signMessage(await getModal(), message, address);
}
