import { Hono } from "hono";
import { chain } from "../../../../common/js/config.js";
import { account } from "../adapters/key/viem/account.js";
import { createClient } from "../adapters/rpc/alchemy/client.js";

const anchor = new Hono();

anchor.post("/run", (c) => {
    const client = createClient({ account, chain });
    return c.json({ ok: true, chainId: client.chain.id });
});

export default anchor;
