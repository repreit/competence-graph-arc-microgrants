import { isNonEmptyString, isPlainObject } from "./a001.js";
import { canonicalPublicKey } from "./attest.js";
import { assertChain, parseContent } from "./delta.js";

const NODE_FIELDS = ["id", "position", "data", "nodeIds"];
const PATCH_FIELDS = ["position", "data"];
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
    const node = { id: value.id };
    if (value.position != null) {
        const position = parsePosition(value.position);
        if (position == null) {
            return null;
        }
        node.position = position;
    }
    node.data = data;
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

function parseOp(value) {
    if (!isPlainObject(value)) {
        return null;
    }
    if (value.type === "node.create") {
        if (!hasOnlyFields(value, ["type", "node"])) {
            return null;
        }
        const node = parseNodePatch(value.node);
        if (node == null) {
            return null;
        }
        return { type: "node.create", node };
    }
    if (value.type === "node.set") {
        if (!hasOnlyFields(value, ["type", "node"])) {
            return null;
        }
        const node = parseNodePatch(value.node);
        if (node == null) {
            return null;
        }
        return { type: "node.set", node };
    }
    if (value.type === "node.delete") {
        if (
            !hasOnlyFields(value, ["type", "id"]) ||
            !isNonEmptyString(value.id)
        ) {
            return null;
        }
        return { type: "node.delete", id: value.id };
    }
    if (value.type === "link.add" || value.type === "link.remove") {
        if (!hasOnlyFields(value, ["type", "a", "b"])) {
            return null;
        }
        if (!isNonEmptyString(value.a) || !isNonEmptyString(value.b)) {
            return null;
        }
        if (value.a === value.b) {
            return null;
        }
        return { type: value.type, a: value.a, b: value.b };
    }
    return null;
}

export function historyContent(publicKey, ops) {
    const key = canonicalPublicKey(publicKey);
    if (key == null) {
        throw new TypeError("history");
    }
    return JSON.stringify({
        type: "history",
        publicKey: JSON.parse(key),
        ops,
    });
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
    for (const op of parsed.ops) {
        const parsedOp = parseOp(op);
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

export function linkState(nodeA, nodeB) {
    const forward = (nodeA.nodeIds ?? []).includes(nodeB.id);
    const backward = (nodeB.nodeIds ?? []).includes(nodeA.id);
    if (forward !== backward) {
        return "unpaired";
    }
    return forward ? "linked" : "unlinked";
}

function applyOp(state, op) {
    if (op.type === "node.create") {
        if (state.has(op.node.id)) {
            return { ok: false, error: "exists" };
        }
        state.set(op.node.id, mergeNode(null, op.node));
        return { ok: true };
    }
    if (op.type === "node.delete") {
        if (!state.has(op.id)) {
            return { ok: false, error: "missing" };
        }
        state.delete(op.id);
        return { ok: true };
    }
    if (op.type === "node.set") {
        const id = op.node.id;
        const node = state.get(id);
        if (node == null) {
            return { ok: false, error: "missing" };
        }
        state.set(id, mergeNode(node, op.node));
        return { ok: true };
    }
    if (op.type === "link.add") {
        const nodeA = state.get(op.a);
        const nodeB = state.get(op.b);
        if (nodeA == null || nodeB == null) {
            return { ok: false, error: "missing" };
        }
        const link = linkState(nodeA, nodeB);
        if (link === "linked") {
            return { ok: false, error: "exists" };
        }
        if (link === "unpaired") {
            return { ok: false, error: "unpaired" };
        }
        state.set(
            op.a,
            mergeNode(nodeA, {
                id: op.a,
                nodeIds: (nodeA.nodeIds ?? []).concat(op.b),
            }),
        );
        state.set(
            op.b,
            mergeNode(nodeB, {
                id: op.b,
                nodeIds: (nodeB.nodeIds ?? []).concat(op.a),
            }),
        );
        return { ok: true };
    }
    if (op.type === "link.remove") {
        const nodeA = state.get(op.a);
        const nodeB = state.get(op.b);
        if (nodeA == null || nodeB == null) {
            return { ok: false, error: "missing" };
        }
        const link = linkState(nodeA, nodeB);
        if (link === "unlinked") {
            return { ok: false, error: "missing" };
        }
        if (link === "unpaired") {
            return { ok: false, error: "unpaired" };
        }
        state.set(
            op.a,
            mergeNode(nodeA, {
                id: op.a,
                nodeIds: (nodeA.nodeIds ?? []).filter(function (id) {
                    return id !== op.b;
                }),
            }),
        );
        state.set(
            op.b,
            mergeNode(nodeB, {
                id: op.b,
                nodeIds: (nodeB.nodeIds ?? []).filter(function (id) {
                    return id !== op.a;
                }),
            }),
        );
        return { ok: true };
    }
    return { ok: false, error: "invalid" };
}

function touchedIds(op) {
    if (op.type === "node.create" || op.type === "node.set") {
        return [op.node.id];
    }
    if (op.type === "node.delete") {
        return [op.id];
    }
    if (op.type === "link.add" || op.type === "link.remove") {
        return [op.a, op.b];
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

function applyOpsToState(state, ops) {
    const touched = new Set();
    for (const op of ops) {
        const applied = applyOp(state, op);
        if (!applied.ok) {
            return applied;
        }
        for (const id of touchedIds(op)) {
            touched.add(id);
        }
        if (op.type === "node.delete") {
            for (const [id, node] of state) {
                if (!(node.nodeIds ?? []).includes(op.id)) {
                    continue;
                }
                const nodeIds = node.nodeIds.filter(function (nodeId) {
                    return nodeId !== op.id;
                });
                state.set(id, mergeNode(node, { id, nodeIds }));
                touched.add(id);
            }
        }
    }
    for (const id of touched) {
        const node = state.get(id);
        if (node == null) {
            continue;
        }
        const parsed = parseNode(node);
        if (parsed == null) {
            return { ok: false, error: "invalid" };
        }
        state.set(id, parsed);
    }
    return { ok: true };
}

function historyFromState(state) {
    const broken = findBrokenLink(state);
    if (broken != null) {
        return { ok: false, error: broken };
    }
    return { ok: true, history: { nodes: Array.from(state.values()) } };
}

export function applyOps(nodes, ops) {
    if (!Array.isArray(nodes) || !Array.isArray(ops)) {
        return { ok: false, error: "invalid" };
    }
    const state = new Map();
    for (const node of nodes) {
        const parsed = parseNode(node);
        if (parsed == null) {
            return { ok: false, error: "invalid" };
        }
        state.set(parsed.id, parsed);
    }
    const applied = applyOpsToState(state, ops);
    if (!applied.ok) {
        return applied;
    }
    return historyFromState(state);
}

export async function foldHistory(rows) {
    if (!Array.isArray(rows)) {
        return { ok: false, error: "invalid" };
    }
    const state = new Map();
    let prev = null;
    for (const row of rows) {
        const checked = await assertChain(prev, row);
        if (!checked.ok) {
            return { ok: false, error: checked.error };
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
        const applied = applyOpsToState(state, parsed.ops);
        if (!applied.ok) {
            return applied;
        }
    }
    return historyFromState(state);
}
