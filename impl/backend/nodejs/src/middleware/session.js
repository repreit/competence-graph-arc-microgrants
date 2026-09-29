import { findBySessionToken } from "../adapters/db/postgres/tables/sessions.js";

export function publicAccount(row) {
    return { id: Number(row.id), address: row.address };
}

export function bearerToken(c) {
    const header = c.req.header("authorization");
    if (!header) {
        return null;
    }
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) {
        return null;
    }
    const token = match[1].trim();
    return token.length > 0 ? token : null;
}

export async function requireSession(c, next) {
    const account = await findBySessionToken(bearerToken(c));
    if (!account) {
        return c.json({ error: "unauthorized" }, 401);
    }
    c.set("account", account);
    await next();
}
