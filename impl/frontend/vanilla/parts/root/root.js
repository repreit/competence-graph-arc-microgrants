import { bindDifference } from "../difference/difference.js";
import { bindHistory } from "../history/history.js";
import { bindFooter } from "../footer/footer.js";

function addPartStyles() {
    ["header", "difference", "history", "footer"].forEach(function (name) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "parts/" + name + "/" + name + ".css";
        document.head.appendChild(link);
    });
}

function loadPart(name) {
    return fetch("parts/" + name + "/" + name + ".html").then(
        function (response) {
            if (!response.ok) {
                throw new Error("parts/" + name + "/" + name + ".html");
            }
            return response.text();
        },
    );
}

function putPart(name, html) {
    const slot = document.querySelector('[data-part="' + name + '"]');
    if (!slot) {
        throw new Error("missing slot " + name);
    }
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    slot.replaceWith(...Array.from(template.content.childNodes));
}

function assemblePage() {
    addPartStyles();
    return loadPart("root").then(function (html) {
        document.body.insertAdjacentHTML("afterbegin", html.trim());
        const names = ["header", "difference", "history", "footer"];
        return Promise.all(names.map(loadPart)).then(function (htmls) {
            names.forEach(function (name, i) {
                putPart(name, htmls[i]);
            });
        });
    });
}

function bindPage() {
    bindDifference();
    bindHistory();
    bindFooter();
}

assemblePage()
    .then(bindPage)
    .catch(function () {
        document.body.insertAdjacentHTML(
            "afterbegin",
            '<p class="muted">Could not load this page. Serve this folder with a local server, or open the GitHub Pages demo.</p>',
        );
    });
