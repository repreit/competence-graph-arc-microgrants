import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { withHexPrefix } from "../../../../../../common/js/a001.js";

const LEAF_ENCODING = ["address", "bytes32"];

export function merkleRoot(tips) {
    const values = tips.map((tip) => [
        tip.address.toLowerCase(),
        withHexPrefix(tip.tipHash),
    ]);
    return StandardMerkleTree.of(values, LEAF_ENCODING).root;
}
