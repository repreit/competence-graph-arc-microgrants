import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain, mainnet } from "@reown/appkit/networks";

let modalPromise;
let hostNetwork;
let publicConfigPromise;

function apiBase() {
    const query = new URLSearchParams(location.search).get("api");
    if (query) {
        return query.replace(/\/$/, "");
    }
    if (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
    ) {
        return "http://127.0.0.1:3000";
    }
    return "";
}

function hexFromUtf8(text) {
    const bytes = new TextEncoder().encode(text);
    let out = "0x";
    for (let i = 0; i < bytes.length; i += 1) {
        out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
}

function fetchPublicConfig() {
    if (!publicConfigPromise) {
        publicConfigPromise = loadPublicConfig();
    }
    return publicConfigPromise;
}

async function loadPublicConfig() {
    const base = apiBase();
    if (!base) {
        throw new Error("api");
    }
    const response = await fetch(base + "/public-config");
    const data = await response.json().catch(function () {
        return {};
    });
    if (!response.ok || data.chain?.id == null) {
        throw new Error("chain");
    }
    if (!data.app?.name) {
        throw new Error("api");
    }
    return data;
}

function networkFromHostChain(chain) {
    const id = Number(chain.id);
    if (id === 1 && !chain.rpcUrl) {
        return mainnet;
    }
    if (!chain.rpcUrl || !chain.name || !chain.nativeCurrency) {
        throw new Error("chain");
    }
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

function getModal() {
    if (!modalPromise) {
        modalPromise = createModal();
    }
    return modalPromise;
}

async function createModal() {
    const config = await fetchPublicConfig();
    const projectId = (config.reown && config.reown.projectId) || "";
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
        features: {
            analytics: Boolean(config.reown?.analytics),
        },
    });
}

function eip155Provider(modal) {
    if (typeof modal.getWalletProvider === "function") {
        const provider = modal.getWalletProvider();
        if (provider) {
            return provider;
        }
    }
    if (typeof modal.getProviders === "function") {
        const providers = modal.getProviders();
        if (providers && providers.eip155) {
            return providers.eip155;
        }
    }
    return null;
}

function waitForConnect(modal) {
    return new Promise(function (resolve, reject) {
        let seenOpen = false;
        let settled = false;

        function finish(err, address) {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            if (unsubProvider) {
                unsubProvider();
            }
            if (unsubState) {
                unsubState();
            }
            if (err) {
                reject(err);
            } else {
                resolve(address);
            }
        }

        const timer = setTimeout(function () {
            finish(new Error("wallet"));
        }, 120000);

        const unsubProvider =
            typeof modal.subscribeProvider === "function"
                ? modal.subscribeProvider(function (state) {
                      if (state && state.isConnected && state.address) {
                          finish(null, state.address);
                      }
                  })
                : null;

        const unsubState =
            typeof modal.subscribeState === "function"
                ? modal.subscribeState(function (state) {
                      if (state && state.open) {
                          seenOpen = true;
                          return;
                      }
                      if (
                          seenOpen &&
                          !(modal.getIsConnected && modal.getIsConnected())
                      ) {
                          finish(new Error("wallet"));
                      }
                  })
                : null;

        try {
            const opened = modal.open({ view: "Connect" });
            if (opened && typeof opened.then === "function") {
                opened.catch(function () {
                    finish(new Error("wallet"));
                });
            }
        } catch (err) {
            finish(new Error("wallet"));
        }
    });
}

export async function requestAccount() {
    const modal = await getModal();
    if (modal.getIsConnected && modal.getIsConnected()) {
        const address = modal.getAddress && modal.getAddress();
        if (address) {
            return address;
        }
    }
    return waitForConnect(modal);
}

export async function hostChainId() {
    await getModal();
    if (!hostNetwork) {
        throw new Error("chain");
    }
    return Number(hostNetwork.id);
}

export async function switchChain() {
    const modal = await getModal();
    if (!hostNetwork) {
        throw new Error("chain");
    }
    try {
        await modal.switchNetwork(hostNetwork);
    } catch (err) {
        if (err && err.code === 4001) {
            throw err;
        }
        throw new Error("chain");
    }
}

export async function signMessage(message, address) {
    const modal = await getModal();
    const provider = eip155Provider(modal);
    if (!provider || typeof provider.request !== "function") {
        throw new Error("wallet");
    }
    return provider.request({
        method: "personal_sign",
        params: [hexFromUtf8(message), address],
    });
}
