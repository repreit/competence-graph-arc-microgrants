import { parseBindContent } from "../../../../../../../common/js/attest.js";
import { appendDelta, findTip } from "./deltas.js";
import { pool } from "../pool.js";

function canonicalPublicKey(publicKey) {
    return JSON.stringify(publicKey);
}

export async function listBindings(accountId) {
    const { rows } = await pool.query(
        `SELECT b.id, b.public_key, b.bind_seq, b.unbind_seq,
            da.received_at AS bind_at,
            dr.received_at AS unbind_at
     FROM bindings b
     JOIN deltas da ON da.account_id = b.account_id AND da.seq = b.bind_seq
     LEFT JOIN deltas dr ON dr.account_id = b.account_id AND dr.seq = b.unbind_seq
     WHERE b.account_id = $1
     ORDER BY da.received_at DESC`,
        [accountId],
    );
    return rows.map((row) => ({
        id: row.id,
        publicKey: JSON.parse(row.public_key),
        bindAt: row.bind_at,
        unbindAt: row.unbind_at,
        bindSeq: row.bind_seq,
        unbindSeq: row.unbind_seq,
    }));
}

export async function bindKey(accountId, { content, signature }) {
    const publicKey = parseBindContent(content);
    if (publicKey == null) {
        return { ok: false, error: "invalid" };
    }
    const keyText = canonicalPublicKey(publicKey);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const appended = await appendDelta(
            accountId,
            { content, signature },
            client,
        );
        if (!appended.ok) {
            await client.query("ROLLBACK");
            return appended;
        }
        const bindSeq = appended.row.seq;
        await client.query(
            `INSERT INTO bindings (account_id, public_key, bind_seq)
       VALUES ($1, $2, $3)`,
            [accountId, keyText, bindSeq],
        );
        await client.query("COMMIT");
        return { ok: true, seq: bindSeq };
    } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505") {
            return { ok: false, error: "duplicate_key" };
        }
        throw err;
    } finally {
        client.release();
    }
}

export async function findActiveBinding(accountId, bindingId) {
    const { rows } = await pool.query(
        `SELECT id, public_key
     FROM bindings
     WHERE id = $1 AND account_id = $2 AND unbind_seq IS NULL`,
        [bindingId, accountId],
    );
    return rows[0] ?? null;
}

export async function unbindKey(accountId, bindingId, { content, signature }) {
    const binding = await findActiveBinding(accountId, bindingId);
    if (!binding) {
        return { ok: false, error: "not_found" };
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows: lockRows } = await client.query(
            `SELECT id FROM bindings
       WHERE id = $1 AND account_id = $2 AND unbind_seq IS NULL
       FOR UPDATE`,
            [bindingId, accountId],
        );
        if (lockRows.length === 0) {
            await client.query("ROLLBACK");
            return { ok: false, error: "not_found" };
        }
        const tip = await findTip(accountId, client);
        if (!tip) {
            await client.query("ROLLBACK");
            return { ok: false, error: "no_chain" };
        }
        const appended = await appendDelta(
            accountId,
            { content, signature },
            client,
        );
        if (!appended.ok) {
            await client.query("ROLLBACK");
            return appended;
        }
        const unbindSeq = appended.row.seq;
        await client.query(
            `UPDATE bindings SET unbind_seq = $3
       WHERE id = $1 AND account_id = $2`,
            [bindingId, accountId, unbindSeq],
        );
        await client.query("COMMIT");
        return { ok: true, seq: unbindSeq };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function findActiveByKey(accountId, publicKey) {
    const keyText = canonicalPublicKey(publicKey);
    const { rows } = await pool.query(
        `SELECT id, public_key FROM bindings
     WHERE account_id = $1 AND public_key = $2 AND unbind_seq IS NULL`,
        [accountId, keyText],
    );
    return rows[0] ?? null;
}
