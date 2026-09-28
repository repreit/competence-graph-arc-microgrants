import { assertLink, parseContent } from "./delta.js";

const NODE_FIELDS = ["id", "position", "data", "nodeIds"];
const DATA_FIELDS = ["title", "link", "img", "alt"];
const POSITION_FIELDS = ["x", "y", "z"];

function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}

function hasOnlyFields(value, fields) {
    return Object.keys(value).every(function (field) {
        return fields.includes(field);
    });
}

function hasOwn(value, field) {
    return Object.hasOwn(value, field);
}

function parsePosition(value) {
    if (!isPlainObject(value) || !hasOnlyFields(value, POSITION_FIELDS)) {
        return null;
    }
    const { x, y, z } = value;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return null;
    }
    return { x, y, z };
}

function parseData(value) {
    if (!isPlainObject(value) || !hasOnlyFields(value, DATA_FIELDS)) {
        return null;
    }
    if (typeof value.title !== "string" || !isNonEmptyString(value.link)) {
        return null;
    }
    const data = { title: value.title, link: value.link };
    for (const field of ["img", "alt"]) {
        if (value[field] == null) {
            continue;
        }
        if (typeof value[field] !== "string") {
            return null;
        }
        data[field] = value[field];
    }
    return data;
}

function parseNodeIds(value, id) {
    if (!Array.isArray(value)) {
        return null;
    }
    const ids = [];
    for (const entry of value) {
        if (!isNonEmptyString(entry) || entry === id) {
            return null;
        }
        ids.push(entry);
    }
    return ids;
}

function parseNode(value) {
    if (!isPlainObject(value) || !hasOnlyFields(value, NODE_FIELDS)) {
        return null;
    }
    if (!isNonEmptyString(value.id)) {
        return null;
    }
    const data = parseData(value.data);
    if (data == null) {
        return null;
    }
    const node = { id: value.id, data: data };
    if (value.position != null) {
        const position = parsePosition(value.position);
        if (position == null) {
            return null;
        }
        node.position = position;
    }
    if (value.nodeIds != null) {
        const nodeIds = parseNodeIds(value.nodeIds, value.id);
        if (nodeIds == null) {
            return null;
        }
        node.nodeIds = nodeIds;
    }
    return node;
}

function parseDataPatch(value) {
    if (!isPlainObject(value) || !hasOnlyFields(value, DATA_FIELDS)) {
        return null;
    }
    const patch = {};
    for (const field of DATA_FIELDS) {
        if (!hasOwn(value, field)) {
            continue;
        }
        const entry = value[field];
        if (entry === null) {
            patch[field] = null;
            continue;
        }
        if (field === "link") {
            if (!isNonEmptyString(entry)) {
                return null;
            }
        } else if (typeof entry !== "string") {
            return null;
        }
        patch[field] = entry;
    }
    return patch;
}

function parsePositionPatch(value) {
    if (!isPlainObject(value) || !hasOnlyFields(value, POSITION_FIELDS)) {
        return null;
    }
    const patch = {};
    for (const axis of POSITION_FIELDS) {
        if (!hasOwn(value, axis)) {
            continue;
        }
        const entry = value[axis];
        if (entry === null) {
            patch[axis] = null;
            continue;
        }
        if (!Number.isFinite(entry)) {
            return null;
        }
        patch[axis] = entry;
    }
    return patch;
}

function parseNodeIdsPatch(value) {
    if (!Array.isArray(value)) {
        return null;
    }
    const ids = [];
    for (const id of value) {
        if (!isNonEmptyString(id)) {
            return null;
        }
        ids.push(id);
    }
    return ids;
}

function parseNodeField(field, value) {
    if (field === "data") {
        return parseDataPatch(value);
    }
    if (field === "position") {
        return parsePositionPatch(value);
    }
    return parseNodeIdsPatch(value);
}

function parseNodePatch(value) {
    if (!isPlainObject(value) || !hasOnlyFields(value, NODE_FIELDS)) {
        return null;
    }
    if (!isNonEmptyString(value.id)) {
        return null;
    }
    const patch = { id: value.id };
    for (const field of ["data", "position", "nodeIds"]) {
        if (!hasOwn(value, field)) {
            continue;
        }
        const entry = value[field];
        if (entry === null) {
            patch[field] = null;
            continue;
        }
        const parsed = parseNodeField(field, entry);
        if (parsed == null) {
            return null;
        }
        patch[field] = parsed;
    }
    return patch;
}

function parseChange(value) {
    if (!isPlainObject(value)) {
        return null;
    }
    if (value.op === "set") {
        if (!hasOnlyFields(value, ["op", "node"])) {
            return null;
        }
        const node = parseNodePatch(value.node);
        if (node == null) {
            return null;
        }
        return { op: "set", node: node };
    }
    if (value.op === "delete") {
        if (
            !hasOnlyFields(value, ["op", "id"]) ||
            !isNonEmptyString(value.id)
        ) {
            return null;
        }
        return { op: "delete", id: value.id };
    }
    return null;
}

export function parseHistoryContent(content) {
    const parsed = parseContent(content);
    if (parsed == null || parsed.type !== "history") {
        return null;
    }
    if (!Array.isArray(parsed.ops)) {
        return null;
    }
    const ops = [];
    for (const change of parsed.ops) {
        const parsedOp = parseChange(change);
        if (parsedOp == null) {
            return null;
        }
        ops.push(parsedOp);
    }
    return { ops };
}

function mergeNode(node, patch) {
    const next = node == null ? { id: patch.id } : Object.assign({}, node);
    for (const field of ["data", "position", "nodeIds"]) {
        if (!hasOwn(patch, field)) {
            continue;
        }
        const entry = patch[field];
        if (entry === null) {
            delete next[field];
            continue;
        }
        if (field === "nodeIds") {
            next[field] = entry.slice();
            continue;
        }
        const merged = Object.assign({}, next[field]);
        for (const name of Object.keys(entry)) {
            if (entry[name] === null) {
                delete merged[name];
            } else {
                merged[name] = entry[name];
            }
        }
        next[field] = merged;
    }
    return next;
}

function applyChange(state, change) {
    if (change.op === "delete") {
        state.delete(change.id);
        return;
    }
    const id = change.node.id;
    state.set(id, mergeNode(state.get(id), change.node));
}

function findBrokenLink(state) {
    for (const node of state.values()) {
        for (const id of node.nodeIds ?? []) {
            const other = state.get(id);
            if (other == null) {
                return "dangling";
            }
            if (!(other.nodeIds ?? []).includes(node.id)) {
                return "unpaired";
            }
        }
    }
    return null;
}

export async function foldHistory(rows) {
    if (!Array.isArray(rows)) {
        return { ok: false, error: "invalid" };
    }
    const state = new Map();
    let prev = null;
    for (const row of rows) {
        const link = await assertLink(prev, row);
        if (!link.ok) {
            return { ok: false, error: link.error };
        }
        prev = row;
        const parsed = parseHistoryContent(row.content);
        if (parsed == null) {
            continue;
        }
        const touched = new Set();
        for (const change of parsed.ops) {
            applyChange(state, change);
            touched.add(change.op === "delete" ? change.id : change.node.id);
        }
        for (const id of touched) {
            const node = state.get(id);
            if (node == null) {
                continue;
            }
            const valid = parseNode(node);
            if (valid == null) {
                return { ok: false, error: "invalid" };
            }
            state.set(id, valid);
        }
        const broken = findBrokenLink(state);
        if (broken != null) {
            return { ok: false, error: broken };
        }
    }
    return { ok: true, history: { nodes: Array.from(state.values()) } };
}
