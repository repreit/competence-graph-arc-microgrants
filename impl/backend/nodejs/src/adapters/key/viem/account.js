import { privateKeyToAccount } from "viem/accounts";

const key = process.env.HOST_PRIVATE_KEY;
if (!key) {
    throw new Error("HOST_PRIVATE_KEY is missing");
}

export const account = privateKeyToAccount(key);
