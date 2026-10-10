import { createWalletClient, http, publicActions } from "viem";

const url = process.env.ARC_RPC_URL;
if (!url) {
    throw new Error("ARC_RPC_URL is missing");
}

export function createClient({ account, chain }) {
    return createWalletClient({
        account,
        chain,
        transport: http(url),
    }).extend(publicActions);
}
