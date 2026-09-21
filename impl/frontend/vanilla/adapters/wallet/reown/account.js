import { isUserRejected, readAddress } from "./provider.js";

const CONNECT_TIMEOUT_MS = 120000;
const MODAL_CLOSE_GRACE_MS = 1000;

function finishConnect(ctx, err, address) {
    if (ctx.settled) {
        return;
    }
    ctx.settled = true;
    clearTimeout(ctx.timer);
    if (ctx.unsubProvider) {
        ctx.unsubProvider();
    }
    if (ctx.unsubState) {
        ctx.unsubState();
    }
    if (err) {
        ctx.reject(err);
    } else {
        ctx.resolve(address);
    }
}

function waitForConnect(modal) {
    return new Promise(function (resolve, reject) {
        const ctx = {
            seenOpen: false,
            settled: false,
            unsubProvider: null,
            unsubState: null,
            resolve: resolve,
            reject: reject,
            timer: null,
        };

        ctx.timer = setTimeout(function () {
            finishConnect(ctx, new Error("wallet"));
        }, CONNECT_TIMEOUT_MS);

        if (typeof modal.subscribeProvider === "function") {
            ctx.unsubProvider = modal.subscribeProvider(function (state) {
                if (state?.address) {
                    finishConnect(ctx, null, state.address);
                }
            });
        }

        if (typeof modal.subscribeState === "function") {
            ctx.unsubState = modal.subscribeState(function (state) {
                if (state?.open) {
                    ctx.seenOpen = true;
                    return;
                }
                if (!ctx.seenOpen) {
                    return;
                }
                readAddress(modal).then(
                    function (address) {
                        if (address) {
                            finishConnect(ctx, null, address);
                            return;
                        }
                        // AppKit can set the address just after the modal closes.
                        setTimeout(function () {
                            readAddress(modal).then(function (lateAddress) {
                                finishConnect(
                                    ctx,
                                    lateAddress ? null : new Error("wallet"),
                                    lateAddress,
                                );
                            }, function () {
                                finishConnect(ctx, new Error("wallet"));
                            });
                        }, MODAL_CLOSE_GRACE_MS);
                    },
                    function (err) {
                        finishConnect(
                            ctx,
                            isUserRejected(err) ? err : new Error("wallet"),
                        );
                    },
                );
            });
        }

        try {
            const opened = modal.open({ view: "Connect" });
            if (opened && typeof opened.then === "function") {
                opened.catch(function () {
                    finishConnect(ctx, new Error("wallet"));
                });
            }
        } catch (err) {
            finishConnect(ctx, new Error("wallet"));
        }
    });
}

export async function requestAccount(modal) {
    const address = await readAddress(modal);
    if (address) {
        return address;
    }
    return waitForConnect(modal);
}
