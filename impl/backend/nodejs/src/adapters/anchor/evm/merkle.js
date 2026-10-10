import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const LEAF_ENCODING = ["address", "bytes32"];

function toValues(tips) {
    return tips.map((tip) => [tip.address.toLowerCase(), "0x" + tip.tipHash]);
}

export function merkleRoot(tips) {
    return StandardMerkleTree.of(toValues(tips), LEAF_ENCODING).root;
}
