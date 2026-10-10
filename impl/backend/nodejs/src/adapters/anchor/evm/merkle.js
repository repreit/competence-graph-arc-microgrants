import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const TYPES = ["address", "bytes32"];

function toValues(tips) {
    return tips.map((tip) => [tip.address.toLowerCase(), "0x" + tip.tipHash]);
}

export function merkleRoot(tips) {
    return StandardMerkleTree.of(toValues(tips), TYPES).root;
}
