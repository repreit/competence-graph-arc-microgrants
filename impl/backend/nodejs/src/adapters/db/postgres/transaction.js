import { pool } from "./pool.js";

/** Commits whatever `fn` returns; errors roll back. */
export async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch {}
        throw err;
    } finally {
        client.release();
    }
}
