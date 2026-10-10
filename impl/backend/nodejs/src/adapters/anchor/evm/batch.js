import { anchor, chain } from "../../../../../../common/js/config.js";
import { hashRow } from "../../../../../../common/js/delta.js";
import { listTips, maxDeltaId } from "../../db/postgres/tables/deltas.js";
import { account } from "../../key/viem/account.js";
import { createClient } from "../../rpc/alchemy/client.js";
import { anchorAbi } from "./abi.js";
import { merkleRoot } from "./merkle.js";
import { anchorRoot } from "./write.js";

async function listHashedTips(maxId) {
    const rows = await listTips(maxId);
    return Promise.all(
        rows.map(async (row) => ({
            address: row.address,
            tipHash: await hashRow(row),
        })),
    );
}

export async function batchAnchor() {
    const maxId = await maxDeltaId();
    if (maxId == null) {
        return null;
    }
    return anchorRoot({
        client: createClient({ account, chain }),
        address: anchor.address,
        abi: anchorAbi,
        root: merkleRoot(await listHashedTips(maxId)),
        maxDeltaId: maxId,
    });
}
