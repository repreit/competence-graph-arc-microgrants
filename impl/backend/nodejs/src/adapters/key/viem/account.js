import { privateKeyToAccount } from "viem/accounts";

const key = process.env.WALLET_PRIVATE_KEY;
if (!key) {
    throw new Error("WALLET_PRIVATE_KEY is missing");
}

export const account = privateKeyToAccount(key);
