import { applyOps } from "impl/common/js/history.js";
import { shortAddress } from "../../common/js/a001.js";
import { isSessionAccount } from "../../common/js/session.js";
import { on } from "../../common/js/store.js";
import { bindDeed } from "./deed.js";
import { bindHistoryGraph, renderHistory, showHistoryError } from "./graph.js";
import { loadAccounts, loadHistory } from "./load.js";
import {
    createNode,
    discard,
    getPendingOps,
    pendingOpsCount,
} from "./write.js";

let accountsEl;
let selectedAccount;
let accountsPending = null;
let deedCreateEl;
let deedFormEl;
let deedFormTitleEl;
let deedFormLinkEl;
let pendingOpsStatusEl;
let pendingOpsDiscardEl;

function showHistory(account) {
    if (!account || !accountsEl) {
        return;
    }
    selectedAccount = account;
    renderAccountSelection();
    renderMainToolbar();
    if (!account.history && account.address) {
        loadHistory(account.address)
            .then(function (loaded) {
                account.history = loaded.history;
                if (account === selectedAccount) {
                    renderHistory(nodesWithPendingOps(account));
                }
            })
            .catch(function () {
                showHistoryError("Could not load this history.");
            });
        return;
    }
    renderHistory(nodesWithPendingOps(account));
}

function nodesWithPendingOps(account) {
    const committed = (account.history && account.history.nodes) || [];
    const ops = getPendingOps();
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
    renderMainToolbar();
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

function renderMainToolbar() {
    if (!deedCreateEl || !pendingOpsStatusEl || !pendingOpsDiscardEl) {
        return;
    }
    if (isSessionAccount(selectedAccount)) {
        const count = pendingOpsCount();
        deedCreateEl.hidden = false;
        pendingOpsDiscardEl.hidden = count === 0;
        pendingOpsStatusEl.hidden = count === 0;
        pendingOpsStatusEl.textContent = `${count} change(s) not saved`;
    } else {
        deedCreateEl.hidden = true;
        pendingOpsDiscardEl.hidden = true;
        pendingOpsStatusEl.hidden = true;
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

function discardPendingOps() {
    discard();
    renderMainToolbar();
    renderHistory(nodesWithPendingOps(selectedAccount));
}

function createDeed() {
    const title = deedFormTitleEl.value.trim();
    const link = deedFormLinkEl.value.trim();
    if (!title || !link) {
        return;
    }
    createNode({ data: { title, link } });
    toggleDeedForm();
    renderMainToolbar();
    renderHistory(nodesWithPendingOps(selectedAccount));
}

export function bindHistory() {
    bindDeed();
    bindHistoryGraph();
    accountsEl = document.getElementById("accounts");
    deedCreateEl = document.getElementById("deed-create");
    deedFormEl = document.getElementById("deed-form");
    deedFormTitleEl = document.getElementById("deed-form-title");
    deedFormLinkEl = document.getElementById("deed-form-link");
    pendingOpsStatusEl = document.getElementById("pending-ops-status");
    pendingOpsDiscardEl = document.getElementById("pending-ops-discard");
    if (pendingOpsDiscardEl) {
        pendingOpsDiscardEl.addEventListener("click", discardPendingOps);
    }
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
        renderMainToolbar();
    });
    f001();
}
