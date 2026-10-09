import * as THREE from "three";
import { cssColor, historyTheme } from "./paint.js";
import { CARD_HX, CARD_HY, CARD_HZ } from "./cards.js";

export function pairsFromNodes(nodes) {
    const seen = {};
    const pairs = [];
    (nodes || []).forEach(function (node) {
        (node.nodeIds || []).forEach(function (otherId) {
            if (!otherId || otherId === node.id) {
                return;
            }
            const a = node.id;
            const b = otherId;
            const key = a < b ? a + "|" + b : b + "|" + a;
            if (!seen[key]) {
                seen[key] = true;
                pairs.push([a, b]);
            }
        });
    });
    return pairs;
}

function idFrom(value) {
    if (typeof value === "string") {
        return value;
    }
    return value?.id ?? "";
}

export function linkKey(link) {
    const a = idFrom(link?.source);
    const b = idFrom(link?.target);
    if (!a || !b) {
        return "";
    }
    return a < b ? a + "|" + b : b + "|" + a;
}

function boxExitT(from, toward, hx, hy, hz) {
    const dx = toward.x - from.x;
    const dy = toward.y - from.y;
    const dz = toward.z - from.z;
    let t = Infinity;
    if (dx !== 0) {
        t = Math.min(t, hx / Math.abs(dx));
    }
    if (dy !== 0) {
        t = Math.min(t, hy / Math.abs(dy));
    }
    if (dz !== 0) {
        t = Math.min(t, hz / Math.abs(dz));
    }
    if (!isFinite(t) || t <= 0) {
        return 0;
    }
    return t;
}

function along(from, toward, t) {
    return {
        x: from.x + (toward.x - from.x) * t,
        y: from.y + (toward.y - from.y) * t,
        z: from.z + (toward.z - from.z) * t,
    };
}

export function makeLinkObject() {
    const pos = new THREE.BufferAttribute(new Float32Array(6), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", pos);
    const line = new THREE.Line(
        geom,
        new THREE.LineBasicMaterial({
            color: cssColor(historyTheme().ink),
            depthTest: true,
            depthWrite: false,
        }),
    );
    line.userData.historyLink = true;
    line.frustumCulled = false;
    return line;
}

function setLineEnds(line, start, end) {
    const geom = line && line.geometry;
    if (!geom) {
        return;
    }
    let pos = geom.getAttribute("position");
    if (!pos || !pos.array || pos.array.length !== 6) {
        pos = new THREE.BufferAttribute(new Float32Array(6), 3);
        pos.setUsage(THREE.DynamicDrawUsage);
        geom.setAttribute("position", pos);
    }
    pos.setXYZ(0, start.x, start.y || 0, start.z || 0);
    pos.setXYZ(1, end.x, end.y || 0, end.z || 0);
    pos.needsUpdate = true;
    if (typeof geom.computeBoundingSphere === "function") {
        geom.computeBoundingSphere();
    }
}

function rimPoint(from, to) {
    const t = boxExitT(from, to, CARD_HX, CARD_HY, Infinity);
    const point = along(from, to, t);
    point.z = from.z + CARD_HZ;
    return point;
}

export function clipLinkToCards(linkObject, coords) {
    if (!linkObject) {
        return true;
    }
    const start = rimPoint(coords.start, coords.end);
    const end = rimPoint(coords.end, coords.start);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    if (dx * dx + dy * dy + dz * dz < 1e-6) {
        linkObject.visible = false;
        return true;
    }
    linkObject.visible = true;
    setLineEnds(linkObject, start, end);
    return true;
}
