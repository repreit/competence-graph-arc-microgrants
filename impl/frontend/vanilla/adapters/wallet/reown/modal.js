import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain } from "@reown/appkit/networks";
import { apiBase } from "../../../common/js/api.js";

const WALLET_IDS = [
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
];

let modalPromise;
let hostNetwork;

async function loadPublicConfig() {
    const base = apiBase();
    if (!base) {
        throw new Error("api");
    }
    const response = await fetch(base + "/public-config");
    const data = await response.json().catch(function () {
        return {};
    });
    if (!response.ok) {
        throw new Error("api");
    }
    if (!data.app?.name) {
        throw new Error("api");
    }
    return data;
}

function networkFromHostChain(chain) {
    if (
        chain?.id == null ||
        !chain.rpcUrl ||
        !chain.name ||
        !chain.nativeCurrency
    ) {
        throw new Error("chain");
    }
    const id = Number(chain.id);
    const currency = chain.nativeCurrency;
    return defineChain({
        id: id,
        caipNetworkId: "eip155:" + id,
        chainNamespace: "eip155",
        name: chain.name,
        nativeCurrency: {
            name: currency.name,
            symbol: currency.symbol,
            decimals: Number(currency.decimals),
        },
        rpcUrls: {
            default: { http: [chain.rpcUrl] },
        },
        blockExplorers: chain.explorerUrl
            ? {
                  default: {
                      name: chain.name + " Explorer",
                      url: chain.explorerUrl,
                  },
              }
            : undefined,
    });
}

async function createModal() {
    const config = await loadPublicConfig();
    const projectId = config.reown?.projectId || "";
    if (!projectId) {
        throw new Error("reown");
    }

    hostNetwork = networkFromHostChain(config.chain);

    return createAppKit({
        adapters: [new EthersAdapter()],
        networks: [hostNetwork],
        defaultNetwork: hostNetwork,
        projectId: projectId,
        metadata: {
            name: config.app.name,
            description: config.app.description,
            url: location.origin,
            icons: [location.origin + config.app.iconPath],
        },
        includeWalletIds: WALLET_IDS,
        featuredWalletIds: WALLET_IDS,
        allWallets: "HIDE",
        features: {
            analytics: Boolean(config.reown?.analytics),
        },
    });
}

export function getModal() {
    if (!modalPromise) {
        modalPromise = createModal();
    }
    return modalPromise;
}

export function getHostNetwork() {
    if (!hostNetwork) {
        throw new Error("chain");
    }
    return hostNetwork;
}
