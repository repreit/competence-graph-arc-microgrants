import { hashSessionToken } from "../../../auth/siwe/session.js";
import { pool } from "../pool.js";
import { withTransaction } from "../transaction.js";

export async function setSession(address, sessionToken, expiresAt) {
    const tokenHash = hashSessionToken(sessionToken);
    return await withTransaction(async (client) => {
        const { rows } = await client.query(
            `WITH ins AS (
         INSERT INTO accounts (address)
         VALUES ($1)
         ON CONFLICT (address) DO NOTHING
         RETURNING id, address
       )
       SELECT id, address FROM ins
       UNION ALL
       SELECT id, address FROM accounts WHERE address = $1
       LIMIT 1`,
            [address],
        );
        const account = rows[0];
        await client.query(`DELETE FROM sessions WHERE account_id = $1`, [
            account.id,
        ]);
        await client.query(
            `INSERT INTO sessions (account_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
            [account.id, tokenHash, expiresAt],
        );
        return account;
    });
}

export async function findBySessionToken(sessionToken) {
    if (!sessionToken) {
        return null;
    }
    const tokenHash = hashSessionToken(sessionToken);
    const { rows } = await pool.query(
        `SELECT a.id, a.address
     FROM sessions s
     JOIN accounts a ON a.id = s.account_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [tokenHash],
    );
    return rows[0] ?? null;
}

export async function clearSessionToken(sessionToken) {
    if (!sessionToken) {
        return;
    }
    const tokenHash = hashSessionToken(sessionToken);
    await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}
