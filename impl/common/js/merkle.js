import { hexFromBytes } from "./a001.js";

const encoder = new TextEncoder();

export async function hashLeaf(address, tipHash) {
    const bytes = encoder.encode(`${address.toLowerCase()}\n${tipHash}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return hexFromBytes(digest);
}
