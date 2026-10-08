import * as THREE from "three";
import { lang } from "../../common/js/lang.js";
import {
    CARD_HX,
    CARD_HY,
    invalidateCardPaint,
    makeCardObject,
} from "./cards.js";
import { clipLinkToCards, makeLinkObject } from "./links.js";
import { handleDeedClick } from "./history.js";
import {
    disposeGraphGpu,
    paintCardOpaque,
    paintGraphHover,
    paintHistoryGraph,
} from "./paint.js";

let viewportEl;
let statusEl;
let historyGraph = null;
let historyGraphPending = null;
let graphRequest = 0;
let hoveredNodeId = "";
let hoveredNode = null;

let fitTimer = 0;
const FIT_PULL = 1;

export function showHistoryStatus(message) {
    if (!statusEl) {
        return;
    }
    statusEl.hidden = !message;
    statusEl.textContent = message ?? "";
}

function sizeHistoryGraph() {
    if (!historyGraph || !viewportEl) {
        return;
    }
    const width = viewportEl.clientWidth;
    const height = viewportEl.clientHeight;
    if (width < 8 || height < 8) {
        return;
    }
    historyGraph.width(width).height(height);
}

function fitHistoryGraph() {
    if (!historyGraph) {
        return;
    }
    const camera = historyGraph.camera();
    if (camera && camera.up) {
        camera.up.set(0, 1, 0);
    }
    const nodes = historyGraph.graphData().nodes || [];
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    nodes.forEach(function (node) {
        const x = isFinite(node.fx) ? node.fx : node.x || 0;
        const y = isFinite(node.fy) ? node.fy : node.y || 0;
        x0 = Math.min(x0, x - CARD_HX);
        x1 = Math.max(x1, x + CARD_HX);
        y0 = Math.min(y0, y - CARD_HY);
        y1 = Math.max(y1, y + CARD_HY);
    });
    if (!camera || !isFinite(x0) || !isFinite(y0)) {
        return;
    }
    const height = Math.max(historyGraph.height() || 1, 1);
    const paddedFov = (1 - 32 / height) * camera.fov;
    const maxBoxSide = Math.max(x1 - x0, y1 - y0);
    const distance =
        (maxBoxSide / Math.atan((paddedFov * Math.PI) / 180)) *
        Math.max(1, 1 / camera.aspect) *
        FIT_PULL;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    historyGraph.cameraPosition(
        { x: cx, y: cy, z: distance },
        { x: cx, y: cy, z: 0 },
        400,
    );
}

function scheduleFitHistoryGraph() {
    window.clearTimeout(fitTimer);
    fitTimer = window.setTimeout(fitHistoryGraph, 300);
}

function setNodeHovered(node) {
    const nextId = (node && node.id) || "";
    if (nextId === hoveredNodeId) {
        return;
    }
    hoveredNodeId = nextId;
    hoveredNode = node || null;
    if (viewportEl) {
        viewportEl.style.cursor = nextId ? "pointer" : "";
    }
    paintGraphHover(historyGraph, hoveredNodeId);
}

function bindHistoryControls(graph) {
    const controls = graph.controls();
    if (!controls || !controls.mouseButtons) {
        return;
    }
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    if (controls.touches && THREE.TOUCH) {
        controls.touches.ONE = THREE.TOUCH.PAN;
        // TODO: Touch two-finger is zoom and rotate at once (DOLLY_ROTATE).
        // Add a toggle at the top-right of the graph frame: off = zoom, on = rotate (touches.TWO).
        controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    }
    if ("screenSpacePanning" in controls) {
        controls.screenSpacePanning = true;
    }
}

function createHistoryGraph(ForceGraph3D) {
    historyGraph = new ForceGraph3D(viewportEl, { controlType: "orbit" })
        .showNavInfo(false)
        .enableNodeDrag(false)
        .nodeOpacity(1)
        .linkOpacity(1)
        .linkWidth(0)
        .linkThreeObjectExtend(false)
        .linkThreeObject(makeLinkObject)
        .warmupTicks(80)
        .d3AlphaMin(0.001)
        .linkPositionUpdate(clipLinkToCards)
        .nodeThreeObject(function (node) {
            return makeCardObject(node, hoveredNodeId);
        })
        .nodePositionUpdate(function (obj) {
            paintCardOpaque(obj);
        })
        .nodeLabel(function () {
            return "";
        })
        .onNodeHover(function (node) {
            setNodeHovered(node);
        });
    const charge = historyGraph.d3Force("charge");
    if (charge) {
        charge.strength(-3);
    }
    bindHistoryControls(historyGraph);
    paintHistoryGraph(historyGraph);
    sizeHistoryGraph();
    return historyGraph;
}

function ensureHistoryGraph() {
    if (historyGraph) {
        return Promise.resolve(historyGraph);
    }
    if (historyGraphPending) {
        return historyGraphPending;
    }
    if (!viewportEl) {
        return Promise.resolve(null);
    }
    historyGraphPending = import("3d-force-graph")
        .then(function (mod) {
            const ForceGraph3D = mod.default || mod;
            if (typeof ForceGraph3D !== "function") {
                throw new Error("ForceGraph3D");
            }
            return createHistoryGraph(ForceGraph3D);
        })
        .catch(function (err) {
            historyGraphPending = null;
            if (typeof console !== "undefined" && console.error) {
                console.error(err);
            }
            showHistoryStatus(lang.GRAPH_LOAD_FAILED);
            return null;
        });
    return historyGraphPending;
}

function pairsFromNodes(nodes) {
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

function graphDataFromNodes(sourceNodes) {
    const nodes = (sourceNodes || []).map(function (node) {
        const data = node.data || {};
        const item = {
            id: node.id,
            name: data.title || node.id,
            data,
            nodeIds: node.nodeIds,
        };
        const pos = node.position;
        if (
            pos &&
            typeof pos.x === "number" &&
            typeof pos.y === "number" &&
            typeof pos.z === "number" &&
            isFinite(pos.x) &&
            isFinite(pos.y) &&
            isFinite(pos.z)
        ) {
            item.fx = pos.x;
            item.fy = pos.y;
            item.fz = pos.z;
        } else {
            item.fz = 0;
        }
        return item;
    });
    const links = pairsFromNodes(sourceNodes).map(function (pair) {
        return { source: pair[0], target: pair[1] };
    });
    return { nodes, links };
}

export function renderHistoryGraph(nodes) {
    if (!viewportEl) {
        return;
    }
    graphRequest += 1;
    const request = graphRequest;
    ensureHistoryGraph()
        .then(function (graph) {
            if (!graph || request !== graphRequest) {
                return;
            }
            invalidateCardPaint();
            hoveredNodeId = "";
            hoveredNode = null;
            viewportEl.style.cursor = "";
            disposeGraphGpu(graph);
            graph.graphData(graphDataFromNodes(nodes));
            sizeHistoryGraph();
            scheduleFitHistoryGraph();
        })
        .catch(function () {
            showHistoryStatus(lang.GRAPH_DRAW_FAILED);
        });
}

function paintGraphTheme() {
    paintHistoryGraph(historyGraph);
}

export function bindHistoryGraph() {
    viewportEl = document.querySelector(".graph-viewport");
    if (viewportEl) {
        let press = null;
        const hoverWaitMs = 50;
        viewportEl.addEventListener("pointerdown", function (ev) {
            if (ev.button !== 0) {
                press = null;
                return;
            }
            press = { x: ev.clientX, y: ev.clientY };
        });
        viewportEl.addEventListener("pointerup", function (ev) {
            if (!press || ev.button !== 0) {
                press = null;
                return;
            }
            const dx = ev.clientX - press.x;
            const dy = ev.clientY - press.y;
            press = null;
            if (dx * dx + dy * dy >= 100) {
                return;
            }
            window.setTimeout(function () {
                if (hoveredNode) {
                    handleDeedClick(hoveredNode);
                }
            }, hoverWaitMs);
        });
    }
    statusEl = document.getElementById("history-status");
    const resetViewEl = document.querySelector(".graph-reset");
    if (resetViewEl) {
        resetViewEl.addEventListener("click", function () {
            fitHistoryGraph();
        });
    }
    if (window.ResizeObserver && viewportEl) {
        new ResizeObserver(function () {
            sizeHistoryGraph();
        }).observe(viewportEl);
    }
}

if (window.matchMedia) {
    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", paintGraphTheme);
}

window.addEventListener("resize", function () {
    sizeHistoryGraph();
});
