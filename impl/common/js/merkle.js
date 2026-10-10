import { bytesFromHex, hexFromBytes } from "./a001.js";

const encoder = new TextEncoder();

export async function hashLeaf(address, tipHash) {
    const bytes = encoder.encode(`${address.toLowerCase()}\n${tipHash}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return hexFromBytes(digest);
}

export async function hashInternalNode(left, right) {
    const leftBytes = bytesFromHex(left);
    const rightBytes = bytesFromHex(right);
    const bytes = new Uint8Array(leftBytes.length + rightBytes.length);
    bytes.set(leftBytes, 0);
    bytes.set(rightBytes, leftBytes.length);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return hexFromBytes(digest);
}
