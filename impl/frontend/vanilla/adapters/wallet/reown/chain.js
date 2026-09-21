import { getProvider, isChainNotAdded, isUserRejected } from "./provider.js";

function chainIdFromNetwork(network) {
    return "0x" + Number(network.id).toString(16);
}

function chainParams(network) {
    return {
        chainId: chainIdFromNetwork(network),
        chainName: network.name,
        nativeCurrency: network.nativeCurrency,
        rpcUrls: network.rpcUrls?.default?.http || [],
        blockExplorerUrls: network.blockExplorers?.default?.url
            ? [network.blockExplorers.default.url]
            : [],
    };
}

function chainError(err) {
    return isUserRejected(err) ? err : new Error("chain", { cause: err });
}

function requestSwitch(provider, network) {
    return provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdFromNetwork(network) }],
    });
}

async function switchChainWithProvider(provider, network) {
    try {
        await requestSwitch(provider, network);
        return;
    } catch (err) {
        if (!isChainNotAdded(err)) {
            throw chainError(err);
        }
    }
    try {
        await provider.request({
            method: "wallet_addEthereumChain",
            params: [chainParams(network)],
        });
        // Add then switch
        await requestSwitch(provider, network);
    } catch (err) {
        throw chainError(err);
    }
}

export async function switchChain(modal, network) {
    if (!network) {
        throw new Error("chain");
    }
    let appKitError = null;
    try {
        await modal.switchNetwork(network);
        return;
    } catch (err) {
        if (isUserRejected(err)) {
            throw err;
        }
        appKitError = err;
    }

    const provider = getProvider(modal);
    if (!provider) {
        throw chainError(appKitError);
    }
    await switchChainWithProvider(provider, network);
}
