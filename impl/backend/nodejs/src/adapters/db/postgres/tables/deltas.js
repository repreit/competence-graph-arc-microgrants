import {
    assertLink,
    contentPublicKey,
    hashContent,
} from "../../../../../../../common/js/delta.js";
import { pool } from "../pool.js";
import { withTransaction } from "../transaction.js";

export async function findTip(accountId, client, forUpdate = false) {
    if (!client) {
        throw new TypeError("client");
    }
    const { rows } = await client.query(
        `SELECT seq, prev_hash, content, signature
     FROM deltas
     WHERE account_id = $1
     ORDER BY seq DESC
     LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
        [accountId],
    );
    const row = rows[0];
    if (!row) {
        return null;
    }
    // pg returns bigint as a string, but seq is used for arithmetic.
    return { ...row, seq: Number(row.seq) };
}

export async function nextLink(accountId) {
    const tip = await findTip(accountId, pool);
    if (!tip) {
        return { seq: 1, prev_hash: null };
    }
    return { seq: tip.seq + 1, prev_hash: await hashContent(tip.content) };
}

/** Requires an open transaction on `client` (FOR UPDATE must span the insert). */
export async function appendDeltaInTx(accountId, row, client) {
    const tip = await findTip(accountId, client, true);
    const seq = tip ? tip.seq + 1 : 1;
    const prev_hash = tip ? await hashContent(tip.content) : null;
    const next = {
        seq,
        prev_hash,
        content: row.content,
        signature: row.signature,
    };
    const link = await assertLink(tip, next);
    if (!link.ok) {
        return { ok: false, error: link.error };
    }
    if (contentPublicKey(row.content) == null) {
        return { ok: false, error: "invalid" };
    }
    const { rows } = await client.query(
        `INSERT INTO deltas (account_id, seq, prev_hash, content, signature)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, account_id, seq, prev_hash, content, signature, received_at`,
        [accountId, seq, prev_hash, row.content, row.signature],
    );
    return { ok: true, row: { ...rows[0], seq: Number(rows[0].seq) } };
}

export async function appendDelta(accountId, row) {
    try {
        return await withTransaction((client) =>
            appendDeltaInTx(accountId, row, client),
        );
    } catch (err) {
        if (err.code === "23505") {
            return { ok: false, error: "stale_tip" };
        }
        throw err;
    }
}
