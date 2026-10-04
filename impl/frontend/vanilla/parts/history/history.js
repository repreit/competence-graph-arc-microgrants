import { applyOps } from "impl/common/js/history.js";
import { shortAddress } from "../../common/js/a001.js";
import { state } from "../../common/js/store.js";
import { bindDeed } from "./deed.js";
import { bindHistoryGraph, renderHistory, showHistoryError } from "./graph.js";
import { loadAccounts, loadHistory } from "./load.js";
import { pendingOps } from "./write.js";

let accountsEl;
let accounts = [];
let activeAddress = "";

function showHistory(address) {
    const account =
        accounts.find(function (item) {
            return item.address === address;
        }) || accounts[0];
    if (!account || !accountsEl) {
        return;
    }
    activeAddress = account.address || "";
    renderSelection();
    if (!account.history && account.address) {
        loadHistory(account.address)
            .then(function (loaded) {
                account.history = loaded.history;
                if (account.address === activeAddress) {
                    renderHistory(nodesWithPending(account));
                }
            })
            .catch(function () {
                showHistoryError("Could not load this history.");
            });
        return;
    }
    renderHistory(nodesWithPending(account));
}

function nodesWithPending(account) {
    const committed = (account.history && account.history.nodes) || [];
    const ops = pendingOps();
    const isMine = Boolean(
        state.account && state.account.address === account.address,
    );
    if (!isMine || ops.length === 0) {
        return committed;
    }
    const applied = applyOps(committed, ops);
    return applied.ok ? applied.history.nodes : committed;
}

function renderSelection() {
    if (!accountsEl) {
        return;
    }
    accountsEl.querySelectorAll("button").forEach(function (button) {
        button.setAttribute(
            "aria-pressed",
            button.dataset.address === activeAddress ? "true" : "false",
        );
    });
}

function renderAccounts(list) {
    accounts = list;
    if (!accountsEl) {
        return;
    }
    accountsEl.replaceChildren();
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
        accountsEl.appendChild(button);
    });
    renderSelection();
}

export function bindHistory() {
    bindDeed();
    bindHistoryGraph();
    accountsEl = document.getElementById("accounts");
    loadAccounts()
        .then(function (list) {
            renderAccounts(list);
            showHistory(list[0] && list[0].address);
        })
        .catch(function () {
            showHistoryError(
                "Could not load this history. Serve this folder with a local server, or open the hosted version.",
            );
        });
}
