import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const LEAF_ENCODING = ["address", "bytes32"];

export function merkleRoot(tips) {
    const values = tips.map((tip) => [
        tip.address.toLowerCase(),
        "0x" + tip.tipHash,
    ]);
    return StandardMerkleTree.of(values, LEAF_ENCODING).root;
}
