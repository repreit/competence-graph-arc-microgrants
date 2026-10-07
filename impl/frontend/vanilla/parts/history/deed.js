import { isSessionAccount } from "../../common/js/session.js";
import { deleteDeed, selectedAccount } from "./history.js";

let windowEl;
let imageEl;
let titleEl;
let linkEl;
let deleteEl;

let openedNode = null;

export function bindDeed() {
    windowEl = document.getElementById("deed-window");
    imageEl = document.getElementById("deed-image");
    titleEl = document.getElementById("deed-title");
    linkEl = document.getElementById("deed-link");
    deleteEl = document.getElementById("deed-delete");
    if (!windowEl) {
        return;
    }
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
    windowEl.addEventListener("close", function () {
        unlockScroll();
        openedNode = null;
    });
    if (deleteEl) {
        deleteEl.addEventListener("click", function () {
            if (openedNode) {
                deleteDeed(openedNode);
                windowEl.close();
            }
        });
    }
}

function safeUrl(value) {
    if (typeof value !== "string") {
        return "";
    }
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
        return "";
    }
}

export function openDeed(node) {
    if (!windowEl || windowEl.open) {
        return;
    }
    openedNode = node;
    if (deleteEl) {
        deleteEl.hidden = !isSessionAccount(selectedAccount);
    }
    const data = node?.data ?? {};
    titleEl.textContent = data.title || "";
    const href = safeUrl(data.link);
    if (href) {
        linkEl.hidden = false;
        linkEl.href = href;
        linkEl.textContent = data.link;
    } else {
        linkEl.hidden = true;
        linkEl.removeAttribute("href");
        linkEl.textContent = "";
    }
    const src = safeUrl(data.img);
    imageEl.hidden = !src;
    if (src) {
        imageEl.src = src;
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
