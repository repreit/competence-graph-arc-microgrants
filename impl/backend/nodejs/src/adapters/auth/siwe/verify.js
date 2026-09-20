import { getAddress, recoverMessageAddress } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { consumeNonce, nonceIsValid } from "./nonce.js";

const chainId = Number(process.env.SIWE_CHAIN_ID ?? "1");

export async function verifySignedMessage({ message, signature }) {
    let parsed;
    try {
        parsed = parseSiweMessage(message);
    } catch {
        return { ok: false, error: "invalid_message" };
    }

    if (
        !parsed.address ||
        !parsed.nonce ||
        !parsed.domain ||
        parsed.chainId == null
    ) {
        return { ok: false, error: "invalid_message" };
    }

    if (!(await nonceIsValid(parsed.nonce))) {
        return { ok: false, error: "nonce" };
    }

    const fieldsOk = validateSiweMessage({
        address: parsed.address,
        domain: parsed.domain,
        message: parsed,
        nonce: parsed.nonce,
    });
    if (!fieldsOk || Number(parsed.chainId) !== chainId) {
        return { ok: false, error: "invalid_message" };
    }

    let recovered;
    try {
        recovered = await recoverMessageAddress({ message, signature });
    } catch {
        return { ok: false, error: "signature" };
    }

    if (getAddress(recovered) !== getAddress(parsed.address)) {
        return { ok: false, error: "signature" };
    }

    if (!(await consumeNonce(parsed.nonce))) {
        return { ok: false, error: "nonce" };
    }

    return { ok: true, address: parsed.address.toLowerCase() };
}
