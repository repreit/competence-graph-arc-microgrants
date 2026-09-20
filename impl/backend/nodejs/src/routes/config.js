import { Hono } from "hono";
import { chain } from "../config.js";

const config = new Hono();

config.get("/", (c) =>
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

export default config;
