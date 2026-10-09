export async function anchorRoot({ client, address, abi, root }) {
    if (!client || !address || !Array.isArray(abi)) {
        return { ok: false, error: "invalid_request" };
    }
    if (typeof root !== "string" || !root.startsWith("0x")) {
        return { ok: false, error: "invalid_root" };
    }

    let txHash;
    try {
        txHash = await client.writeContract({
            address,
            abi,
            functionName: "anchor",
            args: [root],
        });
    } catch {
        return { ok: false, error: "send" };
    }

    let receipt;
    try {
        receipt = await client.waitForTransactionReceipt({
            hash: txHash,
        });
    } catch {
        return { ok: false, error: "receipt", txHash };
    }

    if (receipt.status !== "success") {
        return { ok: false, error: "reverted", txHash };
    }

    return { ok: true, txHash };
}
