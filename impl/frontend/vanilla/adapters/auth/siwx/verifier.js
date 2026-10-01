import { EIP155Verifier } from "@reown/appkit-siwx";
import { apiFetch } from "../../../common/js/a001.js";
import { setToken } from "../../../common/js/session.js";
import { emit } from "../../../common/js/store.js";

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
                return false;
            }
            session.token = data.token;
            setToken(data.token);
            emit("signedIn", {
                account: { id: data.id, address: data.address },
                authPending: false,
            });
            return true;
        } catch {
            return false;
        }
    }
}

export function createVerifier() {
    return new Verifier();
}
