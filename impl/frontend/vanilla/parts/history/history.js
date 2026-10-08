import { applyOps } from "impl/common/js/history.js";
import { shortAddress } from "../../common/js/a001.js";
import { lang } from "../../common/js/lang.js";
import { isSessionAccount } from "../../common/js/session.js";
import { on } from "../../common/js/store.js";
import { bindDeed } from "./deed.js";
import {
    bindHistoryGraph,
    renderHistoryGraph,
    showHistoryStatus,
} from "./graph.js";
import { loadAccounts, loadHistory } from "./load.js";
import {
    commit,
    createNode,
    deleteNode,
    discard,
    getPendingOps,
    pendingOpsCount,
    setNode,
} from "./write.js";

let accountsEl;
export let selectedAccount;
let accountsPending = null;
let deedCreateEl;
let deedFormEl;
let deedFormTitleEl;
let deedFormLinkEl;
let deedFormSubmitEl;
let editingNode = null;
let pendingOpsSaveEl;
let pendingOpsDiscardEl;
let pendingOpsStatusEl;

function showHistory(account) {
    if (!account || !accountsEl) {
        return;
    }
    selectedAccount = account;
    renderAccountSelection();
    renderMainToolbar();
    if (!account.history && account.address) {
        refreshHistory(account);
        return;
    }
    renderHistoryGraph(nodesWithPendingOps(account));
}

function nodesWithPendingOps(account) {
    const committed = account.history?.nodes || [];
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
            showHistoryStatus(lang.HISTORY_LOAD_FAILED);
        });
}

function renderMainToolbar() {
    if (
        !deedCreateEl ||
        !pendingOpsStatusEl ||
        !pendingOpsSaveEl ||
        !pendingOpsDiscardEl
    ) {
        return;
    }
    if (isSessionAccount(selectedAccount)) {
        const count = pendingOpsCount();
        deedCreateEl.hidden = false;
        pendingOpsSaveEl.hidden = count === 0;
        pendingOpsDiscardEl.hidden = count === 0;
        pendingOpsStatusEl.hidden = count === 0;
        pendingOpsStatusEl.textContent = `${count} change(s) not saved`;
    } else {
        deedCreateEl.hidden = true;
        pendingOpsSaveEl.hidden = true;
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
        deedFormTitleEl?.focus();
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
    editingNode = null;
    deedFormSubmitEl.textContent = "Create";
}

function savePendingOps() {
    commit()
        .then(function (appended) {
            if (!appended) {
                return;
            }
            showHistoryStatus("");
            renderMainToolbar();
            return refreshHistory(selectedAccount);
        })
        .catch(function () {
            showHistoryStatus(lang.HISTORY_SAVE_FAILED);
        });
}

function refreshHistory(account) {
    if (!account || !account.address) {
        return Promise.resolve();
    }
    return loadHistory(account.address)
        .then(function (loaded) {
            account.history = loaded.history;
            if (account === selectedAccount) {
                showHistoryStatus("");
                renderHistoryGraph(nodesWithPendingOps(account));
            }
        })
        .catch(function () {
            showHistoryStatus(lang.HISTORY_LOAD_FAILED);
        });
}

function discardPendingOps() {
    discard();
    renderMainToolbar();
    renderHistoryGraph(nodesWithPendingOps(selectedAccount));
}

function submitDeedForm() {
    if (!isSessionAccount(selectedAccount)) {
        return;
    }
    const title = deedFormTitleEl.value.trim();
    const link = deedFormLinkEl.value.trim();
    if (!title || !link) {
        return;
    }
    if (editingNode) {
        setNode({ id: editingNode.id, data: { title, link } });
    } else {
        createNode({ data: { title, link } });
    }
    toggleDeedForm();
    showHistoryStatus("");
    renderMainToolbar();
    renderHistoryGraph(nodesWithPendingOps(selectedAccount));
}

export function editDeed(node) {
    if (!isSessionAccount(selectedAccount) || !deedFormEl) {
        return;
    }
    editingNode = node;
    deedFormSubmitEl.textContent = "Update";
    deedFormTitleEl.value = node?.data?.title || "";
    deedFormLinkEl.value = node?.data?.link || "";
    if (deedFormEl.hidden) {
        toggleDeedForm();
    } else {
        deedFormTitleEl?.focus();
    }
}

export function deleteDeed(node) {
    if (!node || !isSessionAccount(selectedAccount)) {
        return;
    }
    deleteNode(node.id);
    showHistoryStatus("");
    renderMainToolbar();
    renderHistoryGraph(nodesWithPendingOps(selectedAccount));
}

export function bindHistory() {
    bindDeed();
    bindHistoryGraph();
    accountsEl = document.getElementById("accounts");
    deedCreateEl = document.getElementById("deed-create");
    deedFormEl = document.getElementById("deed-form");
    deedFormTitleEl = document.getElementById("deed-form-title");
    deedFormLinkEl = document.getElementById("deed-form-link");
    deedFormSubmitEl = document.getElementById("deed-form-submit");
    pendingOpsStatusEl = document.getElementById("pending-ops-status");
    pendingOpsSaveEl = document.getElementById("pending-ops-save");
    if (pendingOpsSaveEl) {
        pendingOpsSaveEl.addEventListener("click", savePendingOps);
    }
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
            submitDeedForm();
        });
    }
    on("signedIn", f001);
    on("signedOut", function () {
        discard();
        renderMainToolbar();
    });
    window.addEventListener("beforeunload", function (event) {
        if (pendingOpsCount() > 0) {
            event.preventDefault();
            event.returnValue = "";
        }
    });
    f001();
}
