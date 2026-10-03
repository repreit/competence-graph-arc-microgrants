import { Hono } from "hono";
import { listAccounts } from "../adapters/db/postgres/tables/accounts.js";

const accounts = new Hono();

accounts.get("/list", async (c) => {
    return c.json({ accounts: await listAccounts() });
});

export default accounts;
