import { Hono } from "hono";
import { chain } from "../config.js";

const publicConfig = new Hono();

publicConfig.get("/", (c) =>
    c.json({
        chain: {
            id: chain.id,
            name: chain.name,
            rpcUrl: chain.rpcUrl,
            explorerUrl: chain.explorerUrl,
            nativeCurrency: chain.nativeCurrency,
        },
    }),
);

export default publicConfig;
