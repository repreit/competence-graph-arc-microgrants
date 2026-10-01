import { SIWXMessenger } from "@reown/appkit-siwx";
import { apiFetch, pageUri } from "../../../common/js/a001.js";
import { emit } from "../../../common/js/store.js";

const VERSION = "1";

function fail(authError) {
    emit("authFailed", { authPending: false, authError: authError });
    return new Error("http");
}

async function issueNonce() {
    let result;
    try {
        result = await apiFetch("/auth/nonce");
    } catch {
        throw fail("Could not reach the API.");
    }
    if (!result.response.ok) {
        throw fail("Could not get a nonce from the API.");
    }
    return result.data.nonce;
}

class Messenger extends SIWXMessenger {
    constructor(config) {
        super(config);
        this.version = VERSION;
    }

    stringify(message) {
        return (
            message.domain +
            " wants you to sign in with your Ethereum account:\n" +
            message.accountAddress +
            "\n\nURI: " +
            message.uri +
            "\nVersion: " +
            VERSION +
            "\nChain ID: " +
            String(message.chainId).split(":").pop() +
            "\nNonce: " +
            message.nonce +
            "\nIssued At: " +
            message.issuedAt
        );
    }
}

export function createMessenger() {
    return new Messenger({
        domain: location.host,
        uri: pageUri(),
        getNonce: issueNonce,
    });
}
