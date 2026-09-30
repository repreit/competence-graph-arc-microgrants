import { isNonEmptyString, isPlainObject } from "./a001.js";
import { assertLink, parseContent } from "./delta.js";

const NODE_FIELDS = ["id", "position", "data", "nodeIds"];
const PATCH_FIELDS = ["data", "position"];
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

function parseNodeField(field, value) {
    if (field === "data") {
        return parseDataPatch(value);
    }
    return parsePositionPatch(value);
}

function parseNodePatch(value) {
    if (
        !isPlainObject(value) ||
        !hasOnlyFields(value, ["id", ...PATCH_FIELDS])
    ) {
        return null;
    }
    if (!isNonEmptyString(value.id)) {
        return null;
    }
    const patch = { id: value.id };
    for (const field of PATCH_FIELDS) {
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
    if (value.op === "node.create") {
        if (!hasOnlyFields(value, ["op", "node"])) {
            return null;
        }
        const node = parseNodePatch(value.node);
        if (node == null) {
            return null;
        }
        return { op: "node.create", node: node };
    }
    if (value.op === "node.set") {
        if (!hasOnlyFields(value, ["op", "node"])) {
            return null;
        }
        const node = parseNodePatch(value.node);
        if (node == null) {
            return null;
        }
        return { op: "node.set", node: node };
    }
    if (value.op === "node.delete") {
        if (
            !hasOnlyFields(value, ["op", "id"]) ||
            !isNonEmptyString(value.id)
        ) {
            return null;
        }
        return { op: "node.delete", id: value.id };
    }
    if (value.op === "link.add" || value.op === "link.remove") {
        if (!hasOnlyFields(value, ["op", "a", "b"])) {
            return null;
        }
        if (!isNonEmptyString(value.a) || !isNonEmptyString(value.b)) {
            return null;
        }
        if (value.a === value.b) {
            return null;
        }
        return { op: value.op, a: value.a, b: value.b };
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
    for (const field of [...PATCH_FIELDS, "nodeIds"]) {
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

function linkState(a, b) {
    const forward = (a.nodeIds ?? []).includes(b.id);
    const backward = (b.nodeIds ?? []).includes(a.id);
    if (forward !== backward) {
        return "unpaired";
    }
    return forward ? "linked" : "unlinked";
}

function applyChange(state, change) {
    if (change.op === "node.create") {
        if (state.has(change.node.id)) {
            return { ok: false, error: "exists" };
        }
        state.set(change.node.id, mergeNode(null, change.node));
        return { ok: true };
    }
    if (change.op === "node.delete") {
        if (!state.has(change.id)) {
            return { ok: false, error: "missing" };
        }
        state.delete(change.id);
        return { ok: true };
    }
    if (change.op === "node.set") {
        const id = change.node.id;
        const node = state.get(id);
        if (node == null) {
            return { ok: false, error: "missing" };
        }
        state.set(id, mergeNode(node, change.node));
        return { ok: true };
    }
    if (change.op === "link.add") {
        const a = state.get(change.a);
        const b = state.get(change.b);
        if (a == null || b == null) {
            return { ok: false, error: "missing" };
        }
        const link = linkState(a, b);
        if (link === "linked") {
            return { ok: false, error: "exists" };
        }
        if (link === "unpaired") {
            return { ok: false, error: "unpaired" };
        }
        state.set(
            change.a,
            mergeNode(a, {
                id: change.a,
                nodeIds: (a.nodeIds ?? []).concat(change.b),
            }),
        );
        state.set(
            change.b,
            mergeNode(b, {
                id: change.b,
                nodeIds: (b.nodeIds ?? []).concat(change.a),
            }),
        );
        return { ok: true };
    }
    if (change.op === "link.remove") {
        const a = state.get(change.a);
        const b = state.get(change.b);
        if (a == null || b == null) {
            return { ok: false, error: "missing" };
        }
        const link = linkState(a, b);
        if (link === "unlinked") {
            return { ok: false, error: "missing" };
        }
        if (link === "unpaired") {
            return { ok: false, error: "unpaired" };
        }
        state.set(
            change.a,
            mergeNode(a, {
                id: change.a,
                nodeIds: (a.nodeIds ?? []).filter(function (id) {
                    return id !== change.b;
                }),
            }),
        );
        state.set(
            change.b,
            mergeNode(b, {
                id: change.b,
                nodeIds: (b.nodeIds ?? []).filter(function (id) {
                    return id !== change.a;
                }),
            }),
        );
        return { ok: true };
    }
    return { ok: false, error: "invalid" };
}

function touchedIds(change) {
    if (change.op === "node.create" || change.op === "node.set") {
        return [change.node.id];
    }
    if (change.op === "node.delete") {
        return [change.id];
    }
    if (change.op === "link.add" || change.op === "link.remove") {
        return [change.a, change.b];
    }
    return [];
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
    }
    const broken = findBrokenLink(state);
    if (broken != null) {
        return { ok: false, error: broken };
    }
    return { ok: true, history: { nodes: Array.from(state.values()) } };
}
