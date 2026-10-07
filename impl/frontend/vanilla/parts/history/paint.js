import * as THREE from "three";

export function historyTheme() {
    const styles = getComputedStyle(document.documentElement);
    return {
        bg: styles.getPropertyValue("--bg").trim(),
        ink: styles.getPropertyValue("--ink").trim(),
        line: styles.getPropertyValue("--line").trim(),
        surface: styles.getPropertyValue("--surface").trim(),
    };
}

export function cssColor(value) {
    const color = new THREE.Color();
    if (value) {
        color.setStyle(value);
    }
    return color;
}

function eachPaintedObject(scene, visit) {
    if (!scene || typeof scene.traverse !== "function") {
        return;
    }
    scene.traverse(function (obj) {
        const data = obj.userData;
        if (data && (data.historyCard || data.historyLink)) {
            visit(obj, data);
        }
    });
}

function paintCardMesh(mesh, theme) {
    const card = mesh && mesh.userData && mesh.userData.historyCard;
    if (!card) {
        return;
    }
    paintCardTexture(
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
        mats[5].color.copy(cssColor(theme.surface));
    }
}

export function paintCardOpaque(obj) {
    const mats = obj && obj.material;
    const list = Array.isArray(mats) ? mats : mats ? [mats] : [];
    list.forEach(function (mat) {
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthTest = true;
        mat.depthWrite = true;
    });
}

export function paintGraphHover(graph, hoveredNodeId) {
    if (!graph) {
        return;
    }
    const theme = historyTheme();
    eachPaintedObject(graph.scene(), function (obj, data) {
        const card = data.historyCard;
        if (!card) {
            return;
        }
        const hovered = data.nodeId === hoveredNodeId;
        if (card.hovered === hovered) {
            return;
        }
        card.hovered = hovered;
        paintCardMesh(obj, theme);
    });
}

export function paintHistoryGraph(graph) {
    if (!graph) {
        return;
    }
    const theme = historyTheme();
    const ink = cssColor(theme.ink);
    graph.backgroundColor(theme.bg);
    eachPaintedObject(graph.scene(), function (obj, data) {
        if (data.historyCard) {
            paintCardMesh(obj, theme);
        }
        if (data.historyLink && obj.material) {
            obj.material.color.copy(ink);
        }
    });
}

export function disposeGraphGpu(graph) {
    const objects = [];
    eachPaintedObject(graph && graph.scene && graph.scene(), function (obj) {
        objects.push(obj);
    });
    objects.forEach(disposeObject3D);
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
    return lines.slice(0, 2);
}

function paintCover(ctx, image, x, y, w, h) {
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

export function paintCardTexture(ctx, canvas, data, theme, image, hovered) {
    const w = canvas.width;
    const titleH = 96;
    const imgH = canvas.height - titleH;
    ctx.fillStyle = theme.surface;
    ctx.fillRect(0, 0, w, canvas.height);
    if (image && image.width) {
        paintCover(ctx, image, 0, 0, w, imgH);
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
