import { Hono } from "hono";
import { app, chain, reown } from "../config.js";

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
        app: {
            name: app.name,
            description: app.description,
            iconPath: app.iconPath,
        },
        reown: {
            projectId: reown.projectId,
            analytics: reown.analytics,
        },
    }),
);

export default publicConfig;
