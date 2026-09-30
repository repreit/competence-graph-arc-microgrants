import { bytesFromBase64Url, isNonEmptyString } from "./a001.js";
import { KEY_PARAMS, SIGN_PARAMS } from "./attest.js";
import { signingBytes } from "./delta.js";

export async function verifyDeltaSignature(
    publicKey,
    { seq, prev_hash, content },
    signature,
) {
    if (!isNonEmptyString(signature)) {
        return false;
    }
    try {
        const key = await crypto.subtle.importKey(
            "jwk",
            publicKey,
            KEY_PARAMS,
            false,
            ["verify"],
        );
        const data = signingBytes({ seq, prev_hash, content });
        const sig = bytesFromBase64Url(signature);
        return await crypto.subtle.verify(SIGN_PARAMS, key, sig, data);
    } catch {
        return false;
    }
}
