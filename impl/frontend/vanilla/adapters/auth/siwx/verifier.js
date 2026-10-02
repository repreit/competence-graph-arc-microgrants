import { EIP155Verifier } from "@reown/appkit-siwx";
import { apiFetch } from "../../../common/js/api.js";
import { setToken } from "../../../common/js/session.js";
import { emit } from "../../../common/js/store.js";
import { lang } from "../../../common/js/lang.js";

const ERRORS = {
    nonce: lang.REQUEST_EXPIRED,
    signature: lang.SIGNATURE_INVALID,
    invalid_message: lang.SIGNATURE_INVALID,
};

function errorFor(data) {
    return ERRORS[data && data.error] || lang.SIGN_IN_FAILED;
}

class Verifier extends EIP155Verifier {
    async verify(session) {
        try {
            if (session.token) {
                const { response } = await apiFetch("/auth/me", {
                    headers: { Authorization: "Bearer " + session.token },
                });
                return response.ok;
            }
            const { response, data } = await apiFetch("/auth/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: session.message.toString(),
                    signature: session.signature,
                }),
            });
            if (!response.ok) {
                emit("authFailed", {
                    authPending: false,
                    authError: errorFor(data),
                });
                return false;
            }
            session.token = data.token;
            setToken(data.token);
            emit("signedIn", {
                account: { id: data.id, address: data.address },
                authPending: false,
                authError: "",
            });
            return true;
        } catch {
            emit("authFailed", {
                authPending: false,
                authError: lang.API_UNREACHABLE,
            });
            return false;
        }
    }
}

export function createVerifier() {
    return new Verifier();
}
