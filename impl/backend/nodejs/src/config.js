export const port = Number(process.env.PORT ?? "3000");

export const maxBodyBytes = 65536;

export const chain = {
    id: 5042,
    name: "Arc",
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorerUrl: "https://explorer.arc.io",
    nativeCurrency: {
        name: "USDC",
        symbol: "USDC",
        decimals: 6,
    },
};

export const app = {
    name: "competence-graph",
    description: "A shared language for inspectable competence.",
    iconPath: "/parts/header/img/mark.svg",
};

export const reown = {
    projectId: "9b9d9e82de721b628cb1ee1d62d51448",
    analytics: false,
};
