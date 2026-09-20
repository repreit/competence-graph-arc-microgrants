import * as THREE from "three";

let windowEl;
let imageEl;
let titleEl;
let linkEl;
let boardEl;
let blurbEl;
let addressesEl;
let accounts = [];
let activeAddress = "";
let historyGraph = null;
let historyGraphPending = null;
let historyEpoch = 0;
let hoveredNodeId = "";
let hoveredNode = null;

function openDeed(data) {
    if (!windowEl || windowEl.open) {
        return;
    }
    data = data || {};
    titleEl.textContent = data.title || "";
    if (data.link) {
        linkEl.hidden = false;
        linkEl.href = data.link;
        linkEl.textContent = data.link;
    } else {
        linkEl.hidden = true;
        linkEl.removeAttribute("href");
        linkEl.textContent = "";
    }
    imageEl.hidden = !data.img;
    if (data.img) {
        imageEl.src = data.img;
        imageEl.alt = data.alt || "";
    } else {
        imageEl.removeAttribute("src");
        imageEl.alt = "";
    }
    const scrollY = window.scrollY;
    windowEl.showModal();
    document.body.style.position = "fixed";
    document.body.style.top = "-" + scrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
}

function unlockScroll() {
    const top = document.body.style.top;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    window.scrollTo(0, Math.abs(parseInt(top || "0", 10)));
}

function shortAddress(address) {
    if (!address) {
        return "";
    }
    if (address.length < 12) {
        return address;
    }
    return address.slice(0, 6) + "…" + address.slice(-4);
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

function graphDataFromHistory(history) {
    const sourceNodes = (history && history.nodes) || [];
    const nodes = sourceNodes.map(function (node) {
        const data = node.data || {};
        const item = {
            id: node.id,
            name: data.title || node.id,
            data: data,
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
    return { nodes: nodes, links: links };
}

function historyTheme() {
    const styles = getComputedStyle(document.documentElement);
    return {
        bg: styles.getPropertyValue("--bg").trim(),
        ink: styles.getPropertyValue("--ink").trim(),
        line: styles.getPropertyValue("--line").trim(),
        card: styles.getPropertyValue("--card").trim(),
    };
}

function sizeHistoryGraph() {
    if (!historyGraph || !boardEl) {
        return;
    }
    const width = boardEl.clientWidth;
    const height = boardEl.clientHeight;
    if (width < 8 || height < 8) {
        return;
    }
    historyGraph.width(width).height(height);
}

let fitTimer = 0;
const FIT_PULL = 0.72;

function fitHistoryGraph() {
    if (!historyGraph) {
        return;
    }
    const camera = historyGraph.camera();
    if (camera && camera.up) {
        camera.up.set(0, 1, 0);
    }
    const controls = historyGraph.controls();
    if (controls && controls.target) {
        controls.target.set(0, 0, 0);
    }
    historyGraph.cameraPosition(
        { x: 0, y: 0, z: 400 },
        { x: 0, y: 0, z: 0 },
        0,
    );
    historyGraph.zoomToFit(0, 16);
    const cam = historyGraph.cameraPosition();
    if (!cam) {
        return;
    }
    historyGraph.cameraPosition(
        {
            x: cam.x * FIT_PULL,
            y: cam.y * FIT_PULL,
            z: cam.z * FIT_PULL,
        },
        { x: 0, y: 0, z: 0 },
        400,
    );
}

function scheduleFitHistoryGraph() {
    window.clearTimeout(fitTimer);
    fitTimer = window.setTimeout(fitHistoryGraph, 300);
}

function cssColor(value) {
    const color = new THREE.Color();
    if (value) {
        color.setStyle(value);
    }
    return color;
}

function paintCardMesh(mesh, theme) {
    const card = mesh && mesh.userData && mesh.userData.historyCard;
    if (!card) {
        return;
    }
    paintCard(
        card.ctx,
        card.canvas,
        card.data,
        theme,
        card.image,
        card.hovered,
    );
    card.tex.needsUpdate = true;
    const mats = mesh.material;
    if (Array.isArray(mats) && mats.length >= 6) {
        mats[0].color.copy(cssColor(card.hovered ? theme.ink : theme.line));
        mats[5].color.copy(cssColor(theme.card));
    }
}

function paintHistoryGraph() {
    if (!historyGraph) {
        return;
    }
    const theme = historyTheme();
    const ink = cssColor(theme.ink);
    historyGraph.backgroundColor(theme.bg);
    const scene = historyGraph.scene();
    if (!scene || typeof scene.traverse !== "function") {
        return;
    }
    scene.traverse(function (obj) {
        if (obj.userData && obj.userData.historyCard) {
            paintCardMesh(obj, theme);
        }
        if (obj.userData && obj.userData.historyLink && obj.material) {
            obj.material.color.copy(ink);
        }
    });
}

function disposeMaterial(mat) {
    if (!mat) {
        return;
    }
    if (mat.map) {
        mat.map.dispose();
        mat.map = null;
    }
    mat.dispose();
}

function disposeObject3D(obj) {
    if (!obj) {
        return;
    }
    const seen = [];
    obj.traverse(function (child) {
        if (child.geometry) {
            child.geometry.dispose();
        }
        const mats = child.material;
        const list = Array.isArray(mats) ? mats : mats ? [mats] : [];
        list.forEach(function (mat) {
            if (mat && seen.indexOf(mat) === -1) {
                seen.push(mat);
                disposeMaterial(mat);
            }
        });
    });
}

function disposeHistoryGpu(graph) {
    const scene = graph && graph.scene && graph.scene();
    if (!scene || typeof scene.traverse !== "function") {
        return;
    }
    const objects = [];
    scene.traverse(function (obj) {
        if (
            obj.userData &&
            (obj.userData.historyCard || obj.userData.historyLink)
        ) {
            objects.push(obj);
        }
    });
    objects.forEach(disposeObject3D);
}

function wrapTitle(ctx, text, maxWidth) {
    const words = String(text || "")
        .split(/\s+/)
        .filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach(function (word) {
        const next = line ? line + " " + word : word;
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    });
    if (line) {
        lines.push(line);
    }
    return lines.slice(0, 3);
}

function drawCover(ctx, image, x, y, w, h) {
    const ir = image.width / Math.max(image.height, 1);
    const r = w / h;
    let sx = 0;
    let sy = 0;
    let sw = image.width;
    let sh = image.height;
    if (ir > r) {
        sw = image.height * r;
        sx = (image.width - sw) / 2;
    } else {
        sh = image.width / r;
        sy = (image.height - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function paintCard(ctx, canvas, data, theme, image, hovered) {
    const w = canvas.width;
    const titleH = 96;
    const imgH = canvas.height - titleH;
    ctx.fillStyle = theme.card;
    ctx.fillRect(0, 0, w, canvas.height);
    if (image && image.width) {
        drawCover(ctx, image, 0, 0, w, imgH);
    } else {
        ctx.fillStyle = theme.line;
        ctx.fillRect(0, 0, w, imgH);
    }
    ctx.strokeStyle = hovered ? theme.ink : theme.line;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, canvas.height - 4);
    ctx.fillStyle = theme.ink;
    ctx.font = '600 28px Georgia, "Times New Roman", serif';
    ctx.textBaseline = "top";
    const pad = 22;
    const lines = wrapTitle(ctx, data.title || "", w - pad * 2);
    let ty = imgH + 22;
    lines.forEach(function (line) {
        ctx.fillText(line, pad, ty);
        ty += 34;
    });
}

const CARD_W = 16;
const CARD_H = CARD_W * (384 / 512);
const CARD_D = 0.55;
const CARD_HX = CARD_W / 2;
const CARD_HY = CARD_H / 2;
const CARD_HZ = CARD_D / 2;
const CARD_DEPTH = {
    depthTest: true,
    depthWrite: true,
    transparent: false,
    opacity: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
};

function paintCardOpaque(obj) {
    const mats = obj && obj.material;
    const list = Array.isArray(mats) ? mats : mats ? [mats] : [];
    list.forEach(function (mat) {
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthTest = true;
        mat.depthWrite = true;
    });
}

function nodeThreeObject(node) {
    const data = node.data || {};
    const theme = historyTheme();
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext("2d");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const card = {
        canvas: canvas,
        ctx: ctx,
        tex: tex,
        data: data,
        image: null,
        hovered: node.id === hoveredNodeId,
    };
    paintCard(ctx, canvas, data, theme, null, card.hovered);
    const front = new THREE.MeshBasicMaterial(
        Object.assign({ map: tex, transparent: false, opacity: 1 }, CARD_DEPTH),
    );
    const back = new THREE.MeshBasicMaterial(
        Object.assign(
            { color: cssColor(theme.card), transparent: false, opacity: 1 },
            CARD_DEPTH,
        ),
    );
    const edge = new THREE.MeshBasicMaterial(
        Object.assign(
            {
                color: cssColor(card.hovered ? theme.ink : theme.line),
                transparent: false,
                opacity: 1,
            },
            CARD_DEPTH,
        ),
    );
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D), [
        edge,
        edge,
        edge,
        edge,
        front,
        back,
    ]);
    mesh.userData.historyCard = card;
    mesh.userData.nodeId = node.id;
    mesh.renderOrder = 1;
    paintCardOpaque(mesh);
    if (data.img) {
        const image = new Image();
        const epoch = historyEpoch;
        image.onload = function () {
            if (epoch !== historyEpoch) {
                return;
            }
            card.image = image;
            paintCard(ctx, canvas, data, historyTheme(), image, card.hovered);
            tex.needsUpdate = true;
        };
        image.src = data.img;
    }
    return mesh;
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

function makeLinkObject() {
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

function clipLinkToCards(linkObject, coords) {
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

function setNodeHovered(node) {
    const nextId = (node && node.id) || "";
    if (nextId === hoveredNodeId) {
        return;
    }
    hoveredNodeId = nextId;
    hoveredNode = node || null;
    if (boardEl) {
        boardEl.style.cursor = nextId ? "pointer" : "";
    }
    if (!historyGraph) {
        return;
    }
    const scene = historyGraph.scene();
    if (!scene || typeof scene.traverse !== "function") {
        return;
    }
    const theme = historyTheme();
    scene.traverse(function (obj) {
        const card = obj.userData && obj.userData.historyCard;
        if (!card) {
            return;
        }
        const hovered = obj.userData.nodeId === hoveredNodeId;
        if (card.hovered === hovered) {
            return;
        }
        card.hovered = hovered;
        paintCardMesh(obj, theme);
    });
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

function showGraphLoadError() {
    if (!blurbEl) {
        return;
    }
    blurbEl.hidden = false;
    blurbEl.textContent =
        "Could not load the 3D graph. Check the network and reload.";
}

function createHistoryGraph(ForceGraph3D) {
    historyGraph = new ForceGraph3D(boardEl, { controlType: "orbit" })
        .showNavInfo(false)
        .enableNodeDrag(false)
        .nodeOpacity(1)
        .linkOpacity(1)
        .linkWidth(0)
        .linkThreeObjectExtend(false)
        .linkThreeObject(makeLinkObject)
        .warmupTicks(80)
        .linkPositionUpdate(clipLinkToCards)
        .nodeThreeObject(nodeThreeObject)
        .nodePositionUpdate(function (obj) {
            paintCardOpaque(obj);
        })
        .nodeLabel(function () {
            return "";
        })
        .onNodeHover(function (node) {
            setNodeHovered(node);
        });
    bindHistoryControls(historyGraph);
    paintHistoryGraph();
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
    if (!boardEl) {
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
            showGraphLoadError();
            return null;
        });
    return historyGraphPending;
}

function renderHistory(account) {
    if (!boardEl) {
        return;
    }
    const history = (account && account.history) || {};
    const label = shortAddress(account.address) || "Unknown";
    const address = account.address || "";
    boardEl.setAttribute(
        "aria-label",
        label + ". Click a deed to open details.",
    );
    ensureHistoryGraph().then(function (graph) {
        if (!graph || address !== activeAddress) {
            return;
        }
        historyEpoch += 1;
        hoveredNodeId = "";
        hoveredNode = null;
        boardEl.style.cursor = "";
        disposeHistoryGpu(graph);
        graph.graphData(graphDataFromHistory(history));
        sizeHistoryGraph();
        scheduleFitHistoryGraph();
    });
}

function showHistory(address) {
    const account =
        accounts.find(function (item) {
            return item.address === address;
        }) || accounts[0];
    if (!account || !addressesEl) {
        return;
    }
    activeAddress = account.address || "";
    addressesEl.querySelectorAll("button").forEach(function (button) {
        button.setAttribute(
            "aria-pressed",
            button.dataset.address === activeAddress ? "true" : "false",
        );
    });
    renderHistory(account);
}

function renderAddresses(list) {
    if (!addressesEl) {
        return;
    }
    addressesEl.replaceChildren();
    list.forEach(function (account) {
        const address = account.address || "";
        const button = document.createElement("button");
        button.type = "button";
        button.className = address ? "address" : "";
        button.dataset.address = address;
        button.textContent = shortAddress(address) || "Unknown";
        if (address) {
            button.title = address;
        }
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", function () {
            showHistory(address);
        });
        addressesEl.appendChild(button);
    });
}

if (window.matchMedia) {
    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", paintHistoryGraph);
}

window.addEventListener("resize", function () {
    sizeHistoryGraph();
});

export function bindHistory() {
    windowEl = document.getElementById("deed-window");
    imageEl = document.getElementById("deed-image");
    titleEl = document.getElementById("deed-title");
    linkEl = document.getElementById("deed-link");
    if (windowEl) {
        const closeEl = windowEl.querySelector(".close");
        if (closeEl) {
            closeEl.addEventListener("click", function () {
                windowEl.close();
            });
        }
        windowEl.addEventListener("click", function (event) {
            if (event.target === windowEl) {
                windowEl.close();
            }
        });
        windowEl.addEventListener("close", unlockScroll);
    }
    boardEl = document.querySelector(".network-board");
    if (boardEl) {
        let press = null;
        const hoverWaitMs = 50;
        boardEl.addEventListener("pointerdown", function (ev) {
            if (ev.button !== 0) {
                press = null;
                return;
            }
            press = { x: ev.clientX, y: ev.clientY };
        });
        boardEl.addEventListener("pointerup", function (ev) {
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
                    openDeed(hoveredNode.data || {});
                }
            }, hoverWaitMs);
        });
    }
    blurbEl = document.getElementById("example-blurb");
    addressesEl = document.getElementById("addresses");
    const resetViewEl = document.querySelector(".graph-reset");
    if (resetViewEl) {
        resetViewEl.addEventListener("click", function () {
            fitHistoryGraph();
        });
    }
    if (window.ResizeObserver && boardEl) {
        new ResizeObserver(function () {
            sizeHistoryGraph();
        }).observe(boardEl);
    }
    fetch("accounts/index.json")
        .then(function (response) {
            if (!response.ok) {
                throw new Error("accounts/index.json");
            }
            return response.json();
        })
        .then(function (ids) {
            const list = Array.isArray(ids) ? ids : [];
            return Promise.all(
                list.map(function (id) {
                    return fetch("accounts/" + id + ".json").then(
                        function (response) {
                            if (!response.ok) {
                                throw new Error("accounts/" + id + ".json");
                            }
                            return response.json().then(function (data) {
                                return {
                                    address: id,
                                    history: data.history || { nodes: [] },
                                };
                            });
                        },
                    );
                }),
            );
        })
        .then(function (list) {
            accounts = list;
            renderAddresses(accounts);
            showHistory(accounts[0] && accounts[0].address);
        })
        .catch(function () {
            if (!blurbEl) {
                return;
            }
            blurbEl.hidden = false;
            blurbEl.textContent =
                "Could not load this example. Serve this folder with a local server, or open the GitHub Pages demo.";
        });
}
