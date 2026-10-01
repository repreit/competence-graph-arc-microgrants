import { SIWXMessenger } from "@reown/appkit-siwx";
import { apiFetch, pageUri } from "../../../common/js/a001.js";

const VERSION = "1";

async function issueNonce() {
    const { response, data } = await apiFetch("/auth/nonce");
    if (!response.ok) {
        throw new Error("http");
    }
    return data.nonce;
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
