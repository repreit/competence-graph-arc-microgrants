import { SIWXMessenger } from "@reown/appkit-siwx";
import { api } from "../../../common/js/api.js";
import { pageUri } from "../../../common/js/a001.js";
import { emit } from "../../../common/js/store.js";
import { lang } from "../../../common/js/lang.js";

const VERSION = "1";

function fail(authError) {
    emit("authFailed", { authPending: false, authError: authError });
    return new Error("http");
}

async function issueNonce() {
    try {
        const data = await api("/auth/nonce", { auth: false });
        return data.nonce;
    } catch (err) {
        throw fail(err.status ? lang.NONCE_FAILED : lang.API_UNREACHABLE);
    }
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
