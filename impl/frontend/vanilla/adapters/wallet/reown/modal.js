import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain } from "@reown/appkit/networks";
import { DefaultSIWX } from "@reown/appkit-siwx";
import { app, chain, reown } from "impl/common/js/config.js";
import { createMessenger } from "../../auth/siwx/messenger.js";
import { createVerifier } from "../../auth/siwx/verifier.js";

const WALLET_IDS = [
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
];

let modalPromise;
let hostNetwork;

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
    const projectId = reown?.projectId || "";
    if (!projectId) {
        throw new Error("reown");
    }

    hostNetwork = networkFromHostChain(chain);

    return createAppKit({
        adapters: [new EthersAdapter()],
        networks: [hostNetwork],
        defaultNetwork: hostNetwork,
        projectId: projectId,
        siwx: new DefaultSIWX({
            messenger: createMessenger(),
            verifiers: [createVerifier()],
        }),
        enableReconnect: false,
        metadata: {
            name: app.name,
            description: app.description,
            url: location.origin,
            icons: [new URL(app.iconPath, location.href).href],
        },
        includeWalletIds: WALLET_IDS,
        featuredWalletIds: WALLET_IDS,
        allWallets: "HIDE",
        features: {
            analytics: Boolean(reown?.analytics),
        },
    });
}

export function getModal() {
    if (!modalPromise) {
        modalPromise = createModal().catch(function (err) {
            modalPromise = null;
            throw err;
        });
    }
    return modalPromise;
}
