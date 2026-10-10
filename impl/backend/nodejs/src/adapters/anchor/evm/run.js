import { anchor, chain } from "../../../../../../common/js/config.js";
import { hashRow } from "../../../../../../common/js/delta.js";
import { pool } from "../../db/postgres/pool.js";
import { listTips, maxDeltaId } from "../../db/postgres/tables/deltas.js";
import { account } from "../../key/viem/account.js";
import { createClient } from "../../rpc/alchemy/client.js";
import { anchorAbi } from "./abi.js";
import { merkleRoot } from "./merkle.js";
import { anchorRoot } from "./write.js";

async function toTips(maxId) {
    const rows = await listTips(maxId);
    return Promise.all(
        rows.map(async (row) => ({
            address: row.address,
            tipHash: await hashRow(row),
        })),
    );
}

try {
    const maxId = await maxDeltaId();
    if (maxId == null) {
        console.log("nothing to anchor");
    } else {
        const anchored = await anchorRoot({
            client: createClient({ account, chain }),
            address: anchor.address,
            abi: anchorAbi,
            root: merkleRoot(await toTips(maxId)),
            maxDeltaId: maxId,
        });
        console.log(anchored);
        if (!anchored.ok) {
            process.exitCode = 1;
        }
    }
} finally {
    await pool.end();
}
