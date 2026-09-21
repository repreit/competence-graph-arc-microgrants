import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain, mainnet } from "@reown/appkit/networks";
import { apiBase } from "../../../common/js/api-base.js";

let modalPromise;
let hostNetwork;
let publicConfigPromise;

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
        includeWalletIds: [
            "c57ca95b47569778a828d19178114f2db125b25b778adf5cba72bd778e231769",
        ],
        featuredWalletIds: [
            "c57ca95b47569778a828d19178114f2db125b25b778adf5cba72bd778e231769",
        ],
        allWallets: "HIDE",
        features: {
            analytics: Boolean(config.reown?.analytics),
        },
    });
}

/** AppKit provider, else injected MetaMask. */
function walletProvider(modal) {
    const fromAppKit =
        (typeof modal.getWalletProvider === "function" &&
            modal.getWalletProvider()) ||
        (typeof modal.getProviders === "function" &&
            modal.getProviders()?.eip155);
    if (fromAppKit && typeof fromAppKit.request === "function") {
        return fromAppKit;
    }
    if (window.ethereum && typeof window.ethereum.request === "function") {
        return window.ethereum;
    }
    return null;
}

async function addressFromProvider(provider) {
    if (!provider) {
        return "";
    }
    const accounts = await provider.request({ method: "eth_accounts" });
    return Array.isArray(accounts) && accounts[0] ? accounts[0] : "";
}

function waitForConnect(modal) {
    return new Promise(function (resolve, reject) {
        let seenOpen = false;
        let settled = false;
        let unsubProvider = null;
        let unsubState = null;

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

        if (typeof modal.subscribeProvider === "function") {
            unsubProvider = modal.subscribeProvider(function (state) {
                if (state && state.address) {
                    finish(null, state.address);
                }
            });
        }

        if (typeof modal.subscribeState === "function") {
            unsubState = modal.subscribeState(function (state) {
                if (state && state.open) {
                    seenOpen = true;
                    return;
                }
                if (!seenOpen) {
                    return;
                }
                // Modal closed: AppKit often reports Connected while getIsConnected is false.
                const address = modal.getAddress && modal.getAddress();
                if (address) {
                    finish(null, address);
                    return;
                }
                addressFromProvider(walletProvider(modal)).then(
                    function (fromProvider) {
                        if (fromProvider) {
                            finish(null, fromProvider);
                        } else {
                            finish(new Error("wallet"));
                        }
                    },
                    function (err) {
                        finish(err && err.code === 4001 ? err : new Error("wallet"));
                    },
                );
            });
        }

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
    const existing = modal.getAddress && modal.getAddress();
    if (existing) {
        return existing;
    }
    const fromProvider = await addressFromProvider(walletProvider(modal));
    if (fromProvider) {
        return fromProvider;
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
        return;
    } catch (err) {
        if (err && err.code === 4001) {
            throw err;
        }
    }

    const provider = walletProvider(modal);
    if (!provider) {
        throw new Error("chain");
    }
    const chainIdHex = "0x" + Number(hostNetwork.id).toString(16);
    try {
        await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
        });
        return;
    } catch (err) {
        if (err && err.code === 4001) {
            throw err;
        }
        if (!err || (err.code !== 4902 && err.code !== -32603)) {
            throw new Error("chain");
        }
    }
    try {
        await provider.request({
            method: "wallet_addEthereumChain",
            params: [
                {
                    chainId: chainIdHex,
                    chainName: hostNetwork.name,
                    nativeCurrency: hostNetwork.nativeCurrency,
                    rpcUrls: hostNetwork.rpcUrls?.default?.http || [],
                    blockExplorerUrls: hostNetwork.blockExplorers?.default?.url
                        ? [hostNetwork.blockExplorers.default.url]
                        : [],
                },
            ],
        });
    } catch (err) {
        if (err && err.code === 4001) {
            throw err;
        }
        throw new Error("chain");
    }
}

export async function signMessage(message, address) {
    const modal = await getModal();
    const provider = walletProvider(modal);
    if (!provider) {
        throw new Error("wallet");
    }
    return provider.request({
        method: "personal_sign",
        params: [hexFromUtf8(message), address],
    });
}
