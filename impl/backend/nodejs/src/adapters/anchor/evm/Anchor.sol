// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Anchor {
    event Anchored(bytes32 indexed root, uint256 indexed maxDeltaId);

    function anchor(bytes32 root, uint256 maxDeltaId) external {
        emit Anchored(root, maxDeltaId);
    }
}
