import { en } from "impl/common/js/lang/en.js";

const DICTS = { en };

export const lang = Object.freeze(
    Object.assign(
        {},
        en,
        DICTS[
            (globalThis.navigator?.language?.toLowerCase() || "en").slice(0, 2)
        ],
    ),
);
