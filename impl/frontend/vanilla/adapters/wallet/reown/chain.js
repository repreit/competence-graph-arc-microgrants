import { isUserRejected } from "./provider.js";

function chainError(err) {
    return isUserRejected(err) ? err : new Error("chain", { cause: err });
}

/** AppKit switches and adds the chain; throwOnFailure surfaces its errors. */
export async function switchChain(modal, network) {
    if (!network) {
        throw new Error("chain");
    }
    try {
        await modal.switchNetwork(network, { throwOnFailure: true });
    } catch (err) {
        throw chainError(err);
    }
}
