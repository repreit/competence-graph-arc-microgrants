export const anchorAbi = [
    {
        type: "function",
        name: "anchor",
        stateMutability: "nonpayable",
        inputs: [
            { name: "root", type: "bytes32" },
            { name: "maxDeltaId", type: "uint256" },
        ],
        outputs: [],
    },
    {
        type: "event",
        name: "Anchored",
        inputs: [
            { name: "root", type: "bytes32", indexed: true },
            { name: "maxDeltaId", type: "uint256", indexed: true },
        ],
    },
];
