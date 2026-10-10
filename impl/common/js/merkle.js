import { bytesFromHex, hashBytes } from "./a001.js";

const encoder = new TextEncoder();

export async function hashLeaf(address, tipHash) {
    const bytes = encoder.encode(`${address.toLowerCase()}\n${tipHash}`);
    return hashBytes(bytes);
}

export async function hashInternalNode(left, right) {
    const leftBytes = bytesFromHex(left);
    const rightBytes = bytesFromHex(right);
    const bytes = new Uint8Array(leftBytes.length + rightBytes.length);
    bytes.set(leftBytes, 0);
    bytes.set(rightBytes, leftBytes.length);
    return hashBytes(bytes);
}
