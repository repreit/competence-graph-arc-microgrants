import { pool } from "../pool.js";

export async function findAccountByAddress(address) {
    const { rows } = await pool.query(
        `SELECT id, address FROM accounts WHERE address = $1`,
        [address],
    );
    const row = rows[0];
    return row ? { id: Number(row.id), address: row.address } : null;
}
