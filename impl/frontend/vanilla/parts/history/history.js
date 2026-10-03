import { shortAddress } from "../../common/js/a001.js";
import { bindDeed } from "./deed.js";
import { bindHistoryGraph, renderHistory, showGraphError } from "./graph.js";
import { loadHistory } from "./load.js";

let addressesEl;
let addresses = [];
let activeAddress = "";

function showHistory(address) {
    const account =
        addresses.find(function (item) {
            return item.address === address;
        }) || addresses[0];
    if (!account || !addressesEl) {
        return;
    }
    activeAddress = account.address || "";
    renderSelection();
    if (!account.history && account.address) {
        loadHistory(account.address)
            .then(function (loaded) {
                account.history = loaded.history;
                if (account.address === activeAddress) {
                    renderHistory(account);
                }
            })
            .catch(function () {
                showGraphError("Could not load this history.");
            });
        return;
    }
    renderHistory(account);
}

function renderSelection() {
    if (!addressesEl) {
        return;
    }
    addressesEl.querySelectorAll("button").forEach(function (button) {
        button.setAttribute(
            "aria-pressed",
            button.dataset.address === activeAddress ? "true" : "false",
        );
    });
}

function renderAddresses(list) {
    addresses = list;
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
    renderSelection();
}

export function bindHistory() {
    bindDeed();
    bindHistoryGraph();
    addressesEl = document.getElementById("addresses");
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
            renderAddresses(list);
            showHistory(list[0] && list[0].address);
        })
        .catch(function () {
            showGraphError(
                "Could not load this history. Serve this folder with a local server, or open the hosted version.",
            );
        });
}
