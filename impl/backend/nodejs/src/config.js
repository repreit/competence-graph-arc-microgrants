export const chain = {
    id: Number(process.env.SIWE_CHAIN_ID ?? "5042"),
    name: process.env.SIWE_CHAIN_NAME ?? "Arc",
    rpcUrl: process.env.SIWE_RPC_URL ?? "https://rpc.mainnet.arc.io",
    explorerUrl: process.env.SIWE_EXPLORER_URL ?? "https://explorer.arc.io",
    nativeCurrency: {
        name: process.env.SIWE_CURRENCY_NAME ?? "USDC",
        symbol: process.env.SIWE_CURRENCY_SYMBOL ?? "USDC",
        decimals: Number(process.env.SIWE_CURRENCY_DECIMALS ?? "6"),
    },
};
