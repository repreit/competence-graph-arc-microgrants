import {
    canonicalPublicKey,
    parseBindContent,
} from "../../../../../../../common/js/attest.js";
import { appendDeltaInTx } from "./deltas.js";
import { pool } from "../pool.js";
import { withTransaction } from "../transaction.js";

function uniqueViolation(err) {
    if (err.code !== "23505") {
        return null;
    }
    return err.table === "bindings" ? "duplicate_key" : "stale_tip";
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
        id: Number(row.id),
        publicKey: JSON.parse(row.public_key),
        bindAt: row.bind_at,
        unbindAt: row.unbind_at,
        bindSeq: Number(row.bind_seq),
        unbindSeq: row.unbind_seq == null ? null : Number(row.unbind_seq),
    }));
}

export async function bindKey(
    accountId,
    { seq, prev_hash, content, signature },
) {
    const parsed = parseBindContent(content);
    if (parsed == null) {
        return { ok: false, error: "invalid" };
    }
    const keyText = canonicalPublicKey(parsed.publicKey);
    if (keyText == null) {
        return { ok: false, error: "invalid" };
    }
    try {
        return await withTransaction(async (client) => {
            const appended = await appendDeltaInTx(
                accountId,
                { seq, prev_hash, content, signature },
                client,
            );
            if (!appended.ok) {
                return appended;
            }
            const bindSeq = appended.row.seq;
            await client.query(
                `INSERT INTO bindings (account_id, public_key, bind_seq)
       VALUES ($1, $2, $3)`,
                [accountId, keyText, bindSeq],
            );
            return { ok: true, seq: bindSeq };
        });
    } catch (err) {
        const unique = uniqueViolation(err);
        if (unique) {
            return { ok: false, error: unique };
        }
        throw err;
    }
}

export async function findActiveBinding(
    accountId,
    bindingId,
    client = pool,
    forUpdate = false,
) {
    const { rows } = await client.query(
        `SELECT id, public_key
     FROM bindings
     WHERE id = $1 AND account_id = $2 AND unbind_seq IS NULL${forUpdate ? " FOR UPDATE" : ""}`,
        [bindingId, accountId],
    );
    return rows[0] ?? null;
}

export async function unbindKey(
    accountId,
    bindingId,
    { seq, prev_hash, content, signature },
) {
    try {
        return await withTransaction(async (client) => {
            const binding = await findActiveBinding(
                accountId,
                bindingId,
                client,
                true,
            );
            if (!binding) {
                return { ok: false, error: "not_found" };
            }
            const appended = await appendDeltaInTx(
                accountId,
                { seq, prev_hash, content, signature },
                client,
            );
            if (!appended.ok) {
                return appended;
            }
            const unbindSeq = appended.row.seq;
            await client.query(
                `UPDATE bindings SET unbind_seq = $3
       WHERE id = $1 AND account_id = $2`,
                [bindingId, accountId, unbindSeq],
            );
            return { ok: true, seq: unbindSeq };
        });
    } catch (err) {
        const unique = uniqueViolation(err);
        if (unique) {
            return { ok: false, error: unique };
        }
        throw err;
    }
}

export async function findActiveBindingByKey(accountId, publicKey) {
    const keyText = canonicalPublicKey(publicKey);
    if (keyText == null) {
        return null;
    }
    const { rows } = await pool.query(
        `SELECT id, public_key FROM bindings
     WHERE account_id = $1 AND public_key = $2 AND unbind_seq IS NULL`,
        [accountId, keyText],
    );
    return rows[0] ?? null;
}
