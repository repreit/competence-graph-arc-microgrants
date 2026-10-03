import { foldHistory } from "impl/common/js/history.js";
import { api } from "../../common/js/api.js";

export async function loadHistory(address) {
    const data = await api(
        "/deltas/list?address=" + encodeURIComponent(address),
        { auth: false },
    );
    const folded = await foldHistory(data.deltas);
    return {
        address: data.address,
        history: folded.ok ? folded.history : { nodes: [] },
    };
}
