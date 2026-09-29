import { isPlainObject } from "../../../../common/js/a001.js";

const JSON_TYPE = /^application\/(?:[\w.+-]*\+)?json\b/i;

function isJsonType(value) {
    return typeof value === "string" && JSON_TYPE.test(value.trim());
}

export async function requireJson(c, next) {
    if (!isJsonType(c.req.header("content-type"))) {
        return c.json({ error: "unsupported_media_type" }, 415);
    }
    let body;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "invalid_json" }, 400);
    }
    if (!isPlainObject(body)) {
        return c.json({ error: "invalid_json" }, 400);
    }
    c.set("body", body);
    await next();
}
