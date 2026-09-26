import { getAddress, recoverMessageAddress } from "viem";
import {
    bindMessage,
    unbindMessage,
} from "../../../../../../common/js/attest.js";

async function verifyWalletMessage(address, message, signature) {
    if (
        !address ||
        typeof message !== "string" ||
        typeof signature !== "string"
    ) {
        return { ok: false, error: "invalid_request" };
    }
    let expected;
    try {
        expected = getAddress(address);
    } catch {
        return { ok: false, error: "invalid_request" };
    }
    let recovered;
    try {
        recovered = await recoverMessageAddress({ message, signature });
    } catch {
        return { ok: false, error: "signature" };
    }
    if (getAddress(recovered) !== expected) {
        return { ok: false, error: "signature" };
    }
    return { ok: true, address: expected.toLowerCase() };
}

export async function verifyBindAttestation({ address, publicKey, signature }) {
    if (publicKey == null) {
        return { ok: false, error: "invalid_request" };
    }
    let message;
    try {
        message = bindMessage(getAddress(address), publicKey);
    } catch {
        return { ok: false, error: "invalid_request" };
    }
    return verifyWalletMessage(address, message, signature);
}

export async function verifyUnbindAttestation({
    address,
    bindingId,
    publicKey,
    signature,
}) {
    if (
        publicKey == null ||
        !Number.isSafeInteger(bindingId) ||
        bindingId < 1
    ) {
        return { ok: false, error: "invalid_request" };
    }
    let message;
    try {
        message = unbindMessage(getAddress(address), bindingId, publicKey);
    } catch {
        return { ok: false, error: "invalid_request" };
    }
    return verifyWalletMessage(address, message, signature);
}
