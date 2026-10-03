export const port = Number(process.env.PORT ?? "3000");

export const maxBodyBytes = 65536;

export { app, chain, reown } from "../../../common/js/config.js";
