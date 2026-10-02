import { canonicalPublicKey } from "impl/common/js/attest.js";

const DATABASE = "competence-graph.keys";
const STORE_NAME = "keys";
const VERSION = 1;

let connection = null;

function indexedDbOrThrow() {
    if (!globalThis.indexedDB) {
        throw new Error("indexeddb");
    }
    return globalThis.indexedDB;
}

function open() {
    if (connection == null) {
        connection = new Promise(function (resolve, reject) {
            const pending = indexedDbOrThrow().open(DATABASE, VERSION);
            pending.onupgradeneeded = function () {
                pending.result.createObjectStore(STORE_NAME, {
                    keyPath: "address",
                });
            };
            pending.onsuccess = function () {
                resolve(pending.result);
            };
            pending.onerror = function () {
                connection = null;
                reject(pending.error);
            };
        });
    }
    return connection;
}

function transactionDone(box) {
    return new Promise(function (resolve, reject) {
        box.oncomplete = function () {
            resolve(undefined);
        };
        box.onerror = function () {
            reject(box.error);
        };
        box.onabort = function () {
            reject(box.error);
        };
    });
}

function result(pending) {
    return new Promise(function (resolve, reject) {
        pending.onsuccess = function () {
            resolve(pending.result);
        };
        pending.onerror = function () {
            reject(pending.error);
        };
    });
}

function canonicalJwk(publicKey) {
    const canonical = canonicalPublicKey(publicKey);
    if (canonical == null) {
        throw new Error("key");
    }
    return JSON.parse(canonical);
}

export async function save({ address, publicKey, privateKey }) {
    const record = {
        address: address,
        publicKey: canonicalJwk(publicKey),
        privateKey: privateKey,
        createdAt: Date.now(),
    };
    const box = (await open()).transaction(STORE_NAME, "readwrite");
    const completed = transactionDone(box);
    box.objectStore(STORE_NAME).put(record);
    await completed;
    return record;
}

export async function load(address) {
    const box = (await open()).transaction(STORE_NAME, "readonly");
    const record = await result(box.objectStore(STORE_NAME).get(address));
    return record || null;
}

export async function remove(address) {
    const box = (await open()).transaction(STORE_NAME, "readwrite");
    const completed = transactionDone(box);
    box.objectStore(STORE_NAME).delete(address);
    await completed;
}
