import * as THREE from "three";
import {
    cssColor,
    historyTheme,
    paintCardTexture,
    paintCardOpaque,
} from "./paint.js";

const CARD_W = 16;
const CARD_H = CARD_W * (384 / 512);
const CARD_D = 0.55;
export const CARD_HX = CARD_W / 2;
export const CARD_HY = CARD_H / 2;
export const CARD_HZ = CARD_D / 2;
const CARD_DEPTH = {
    depthTest: true,
    depthWrite: true,
    transparent: false,
    opacity: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
};

let cardPaintEpoch = 0;

export function invalidateCardPaint() {
    cardPaintEpoch += 1;
}

export function makeCardObject(node, hoveredNodeId) {
    const data = node.data || {};
    const theme = historyTheme();
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext("2d");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const card = {
        canvas,
        ctx,
        tex,
        data,
        image: null,
        hovered: node.id === hoveredNodeId,
    };
    paintCardTexture(ctx, canvas, data, theme, null, card.hovered);
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
        const epoch = cardPaintEpoch;
        image.onload = function () {
            if (epoch !== cardPaintEpoch) {
                return;
            }
            card.image = image;
            paintCardTexture(
                ctx,
                canvas,
                data,
                historyTheme(),
                image,
                card.hovered,
            );
            tex.needsUpdate = true;
        };
        image.src = data.img;
    }
    return mesh;
}
