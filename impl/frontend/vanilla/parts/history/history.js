import { applyOps } from "impl/common/js/history.js";
import { shortAddress } from "../../common/js/a001.js";
import { isSessionAccount } from "../../common/js/session.js";
import { on } from "../../common/js/store.js";
import { bindDeed } from "./deed.js";
import { bindHistoryGraph, renderHistory, showHistoryError } from "./graph.js";
import { loadAccounts, loadHistory } from "./load.js";
import { createNode, discard, pendingCount, pendingOps } from "./write.js";

let accountsEl;
let selectedAccount;
let accountsPending = null;
let deedCreateEl;
let deedFormEl;
let deedFormTitleEl;
let deedFormLinkEl;
let deedPendingStatusEl;

function showHistory(account) {
    if (!account || !accountsEl) {
        return;
    }
    selectedAccount = account;
    renderAccountSelection();
    renderDeedControls();
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
    renderDeedControls();
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

function renderDeedControls() {
    if (!deedCreateEl || !deedPendingStatusEl) {
        return;
    }
    if (isSessionAccount(selectedAccount)) {
        const count = pendingCount();
        deedCreateEl.hidden = false;
        deedPendingStatusEl.hidden = count === 0;
        deedPendingStatusEl.textContent = `${count} deed(s) not saved`;
    } else {
        deedCreateEl.hidden = true;
        deedPendingStatusEl.hidden = true;
        closeDeedForm();
    }
}

function toggleDeedForm() {
    if (!deedFormEl) {
        return;
    }
    if (deedFormEl.hidden) {
        deedFormEl.hidden = false;
    } else {
        closeDeedForm();
    }
}

function closeDeedForm() {
    if (!deedFormEl) {
        return;
    }
    deedFormEl.hidden = true;
    deedFormEl.reset();
}

function createDeed() {
    const title = deedFormTitleEl.value.trim();
    const link = deedFormLinkEl.value.trim();
    if (!title || !link) {
        return;
    }
    createNode({ title, link });
    toggleDeedForm();
    renderDeedControls();
    renderHistory(nodesWithPending(selectedAccount));
}

export function bindHistory() {
    bindDeed();
    bindHistoryGraph();
    accountsEl = document.getElementById("accounts");
    deedCreateEl = document.getElementById("deed-create");
    deedFormEl = document.getElementById("deed-form");
    deedFormTitleEl = document.getElementById("deed-form-title");
    deedFormLinkEl = document.getElementById("deed-form-link");
    deedPendingStatusEl = document.getElementById("deed-pending-status");
    if (deedCreateEl) {
        deedCreateEl.addEventListener("click", toggleDeedForm);
    }
    if (deedFormEl) {
        deedFormEl.addEventListener("submit", function (event) {
            event.preventDefault();
            createDeed();
        });
    }
    on("signedIn", f001);
    on("signedOut", function () {
        discard();
        renderDeedControls();
    });
    f001();
}
