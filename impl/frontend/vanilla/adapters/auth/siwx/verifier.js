import { EIP155Verifier } from "@reown/appkit-siwx";
import { provisionKey } from "../../key/provision.js";
import { api } from "../../../common/js/api.js";
import { setToken } from "../../../common/js/session.js";
import { emit } from "../../../common/js/store.js";
import { lang } from "../../../common/js/lang.js";

const ERRORS = {
    nonce: lang.REQUEST_EXPIRED,
    signature: lang.SIGNATURE_INVALID,
    invalid_message: lang.SIGNATURE_INVALID,
};

function errorFor(data) {
    return ERRORS[data?.error] || lang.SIGN_IN_FAILED;
}

class Verifier extends EIP155Verifier {
    async verify(session) {
        if (session.tokenIssued) {
            try {
                await api("/auth/me");
                return true;
            } catch {
                return false;
            }
        }
        try {
            const data = await api("/auth/verify", {
                auth: false,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: session.message.toString(),
                    signature: session.signature,
                }),
            });
            setToken(data.token);
            try {
                await provisionKey(data.address);
            } catch (err) {
                console.error(err);
                setToken("");
                emit("authFailed", {
                    authPending: false,
                    authError: err.status
                        ? errorFor(err.data)
                        : lang.SIGN_IN_FAILED,
                });
                return false;
            }
            session.tokenIssued = true;
            emit("signedIn", {
                account: { id: data.id, address: data.address },
                authPending: false,
                authError: "",
            });
            return true;
        } catch (err) {
            emit("authFailed", {
                authPending: false,
                authError: err.status
                    ? errorFor(err.data)
                    : lang.API_UNREACHABLE,
            });
            return false;
        }
    }
}

export function createVerifier() {
    return new Verifier();
}
