import { parseContent } from "./delta.js";

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

export function parseDeedContent(content) {
    const parsed = parseContent(content);
    if (parsed == null || parsed.type !== "deed") {
        return null;
    }
    const node = parseNode(parsed.node);
    if (node == null) {
        return null;
    }
    return { node };
}
