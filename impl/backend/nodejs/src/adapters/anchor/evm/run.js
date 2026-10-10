import { chain } from "../../../../../../common/js/config.js";
import { pool } from "../../db/postgres/pool.js";
import { batchAnchor } from "./batch.js";

try {
    const anchored = await batchAnchor();
    if (!anchored) {
        console.log("nothing to anchor");
    } else {
        console.log(anchored);
        if (anchored.ok) {
            console.log(`\n${chain.explorerUrl}/tx/${anchored.txHash}`);
        } else {
            process.exitCode = 1;
        }
    }
} finally {
    await pool.end();
}
