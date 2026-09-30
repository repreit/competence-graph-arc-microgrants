import { isNonEmptyString, isPlainObject } from "./a001.js";
import { assertLink, parseContent } from "./delta.js";

const NODE_FIELDS = ["id", "position", "data", "nodeIds"];
const DATA_FIELDS = ["title", "link", "img", "alt"];
const POSITION_FIELDS = ["x", "y", "z"];

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
    for (const nodeId of value) {
        if (!isNonEmptyString(nodeId) || nodeId === id) {
            return null;
        }
        ids.push(nodeId);
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
        const fieldValue = value[field];
        if (fieldValue === null) {
            patch[field] = null;
            continue;
        }
        if (field === "link") {
            if (!isNonEmptyString(fieldValue)) {
                return null;
            }
        } else if (typeof fieldValue !== "string") {
            return null;
        }
        patch[field] = fieldValue;
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
        const fieldValue = value[axis];
        if (fieldValue === null) {
            patch[axis] = null;
            continue;
        }
        if (!Number.isFinite(fieldValue)) {
            return null;
        }
        patch[axis] = fieldValue;
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
        const fieldValue = value[field];
        if (fieldValue === null) {
            patch[field] = null;
            continue;
        }
        const parsed = parseNodeField(field, fieldValue);
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
        const fieldValue = patch[field];
        if (fieldValue === null) {
            delete next[field];
            continue;
        }
        if (field === "nodeIds") {
            next[field] = fieldValue.slice();
            continue;
        }
        const merged = Object.assign({}, next[field]);
        for (const name of Object.keys(fieldValue)) {
            if (fieldValue[name] === null) {
                delete merged[name];
            } else {
                merged[name] = fieldValue[name];
            }
        }
        next[field] = merged;
    }
    return next;
}

function applyChange(state, change) {
    if (change.op === "delete") {
        state.delete(change.id);
        return { ok: true };
    }
    const id = change.node.id;
    state.set(id, mergeNode(state.get(id), change.node));
    return { ok: true };
}

function touchedIds(change) {
    return change.op === "delete" ? [change.id] : [change.node.id];
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
        const envelope = parseContent(row.content);
        if (envelope == null) {
            return { ok: false, error: "invalid" };
        }
        if (envelope.type !== "history") {
            continue;
        }
        const parsed = parseHistoryContent(row.content);
        if (parsed == null) {
            return { ok: false, error: "invalid" };
        }
        const touched = new Set();
        for (const change of parsed.ops) {
            const applied = applyChange(state, change);
            if (!applied.ok) {
                return { ok: false, error: applied.error };
            }
            for (const id of touchedIds(change)) {
                touched.add(id);
            }
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
