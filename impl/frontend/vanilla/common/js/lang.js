import { en } from "../../impl/common/js/lang/en.js";

const DICTS = { en };

export const lang = Object.assign(
    {},
    en,
    DICTS[(navigator.language || "en").slice(0, 2)],
);
