import { applyOps } from "impl/common/js/history.js";
import { shortAddress } from "../../common/js/a001.js";
import { isSessionAccount } from "../../common/js/session.js";
import { on } from "../../common/js/store.js";
import { bindDeed } from "./deed.js";
import { bindHistoryGraph, renderHistory, showHistoryError } from "./graph.js";
import { loadAccounts, loadHistory } from "./load.js";
import { discard, pendingOps } from "./write.js";

let accountsEl;
let selectedAccount;
let accountsPending = null;
let deedCreateEl;
let deedFormEl;

function showHistory(account) {
    if (!account || !accountsEl) {
        return;
    }
    selectedAccount = account;
    renderAccountSelection();
    renderDeedToolbar();
    if (!account.history && account.address) {
        loadHistory(account.address)
            .then(function (loaded) {
                account.history = loaded.history;
                if (account === selectedAccount) {
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
    if (!isSessionAccount(account) || ops.length === 0) {
        return committed;
    }
    const applied = applyOps(committed, ops);
    return applied.ok ? applied.history.nodes : committed;
}

function renderAccountSelection() {
    if (!accountsEl) {
        return;
    }
    accountsEl.querySelectorAll("button").forEach(function (button) {
        button.setAttribute(
            "aria-pressed",
            button.dataset.address === selectedAccount?.address
                ? "true"
                : "false",
        );
    });
}

function renderAccounts(list) {
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
            showHistory(account);
        });
        accountsEl.appendChild(button);
    });
    renderAccountSelection();
    renderDeedToolbar();
}

function showAccounts() {
    if (accountsPending) {
        return accountsPending;
    }
    accountsPending = loadAccounts()
        .then(function (list) {
            renderAccounts(list);
            return list;
        })
        .finally(function () {
            accountsPending = null;
        });
    return accountsPending;
}

function f001() {
    showAccounts()
        .then(function (list) {
            showHistory(
                list.find(function (account) {
                    return account.address === selectedAccount?.address;
                }) || list[0],
            );
        })
        .catch(function () {
            showHistoryError(
                "Could not load this history. Serve this folder with a local server, or open the hosted version.",
            );
        });
}

function renderDeedToolbar() {
    if (!deedCreateEl) {
        return;
    }
    deedCreateEl.hidden = !isSessionAccount(selectedAccount);
}

function toggleDeedForm() {
    if (!deedFormEl) {
        return;
    }
    deedFormEl.hidden = !deedFormEl.hidden;
    if (deedFormEl.hidden) {
        deedFormEl.reset();
    }
}

export function bindHistory() {
    bindDeed();
    bindHistoryGraph();
    accountsEl = document.getElementById("accounts");
    deedCreateEl = document.getElementById("deed-create");
    deedFormEl = document.getElementById("deed-form");
    if (deedCreateEl) {
        deedCreateEl.addEventListener("click", toggleDeedForm);
    }
    if (deedFormEl) {
        deedFormEl.addEventListener("submit", function (event) {
            event.preventDefault();
        });
    }
    on("signedIn", f001);
    on("signedOut", function () {
        discard();
        renderDeedToolbar();
    });
    f001();
}
