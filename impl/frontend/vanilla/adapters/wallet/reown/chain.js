import { getProvider, isUserRejected } from "./provider.js";

function chainIdHex(network) {
    return "0x" + Number(network.id).toString(16);
}

function addChainParams(network) {
    return {
        chainId: chainIdHex(network),
        chainName: network.name,
        nativeCurrency: network.nativeCurrency,
        rpcUrls: network.rpcUrls?.default?.http || [],
        blockExplorerUrls: network.blockExplorers?.default?.url
            ? [network.blockExplorers.default.url]
            : [],
    };
}

async function switchViaProvider(provider, network) {
    try {
        await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex(network) }],
        });
        return;
    } catch (err) {
        if (isUserRejected(err)) {
            throw err;
        }
        if (!err || (err.code !== 4902 && err.code !== -32603)) {
            throw new Error("chain");
        }
    }
    try {
        await provider.request({
            method: "wallet_addEthereumChain",
            params: [addChainParams(network)],
        });
    } catch (err) {
        if (isUserRejected(err)) {
            throw err;
        }
        throw new Error("chain");
    }
}

export async function switchChain(modal, network) {
    if (!network) {
        throw new Error("chain");
    }
    try {
        await modal.switchNetwork(network);
        return;
    } catch (err) {
        if (isUserRejected(err)) {
            throw err;
        }
    }

    const provider = getProvider(modal);
    if (!provider) {
        throw new Error("chain");
    }
    await switchViaProvider(provider, network);
}
