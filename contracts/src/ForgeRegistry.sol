// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Verified against the REAL deployed processor on an X Layer fork (BUILD.md 2.3):
/// eval(uint256,bytes) selector 0x934d06ea. Read-only.
interface IProcessor {
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory);
}

/// ForgeRegistry (BUILD.md section 4.3). Ownerless: no admin address, no pause, no
/// upgradability. specHash => best known verified circuit for that spec. Anyone may
/// replace an entry with a strictly cheaper (lower C) verified circuit.
contract ForgeRegistry {
    struct Entry {
        address processor;
        uint256 circuitId;
        uint32 gates;
        uint32 depth;
        uint8 nIn;
        uint8 nOut;
        bool onchainVerified;
        bytes32 proofHash;
        address submitter;
    }

    /// Circuits with nIn above this are "offchain-proof" only (attestation via
    /// proofHash, never independently checked by this contract) per BUILD.md 4.3.
    uint8 public constant MAX_ONCHAIN_VERIFY_INPUTS = 6;

    mapping(bytes32 => Entry) public best;

    event Registered(
        bytes32 indexed specHash,
        address processor,
        uint256 circuitId,
        uint32 gates,
        uint32 depth,
        uint256 c,
        address submitter,
        bool onchainVerified
    );

    error NotStrictlyBetter();
    error VerificationFailed(uint256 input);
    error BadExpectedOutputsLength();

    /// FabX with-buffers cost convention (docs/CONVENTION-CHECK.md): C = gates * max(depth,1)^3.
    /// Caller passes gates/depth already including the 2-buffer-per-output tape-out convention
    /// if that is the comparison basis being used; this contract itself is convention-agnostic.
    function cost(uint32 gates, uint32 depth) public pure returns (uint256) {
        uint256 d = depth == 0 ? 1 : depth;
        return uint256(gates) * d * d * d;
    }

    /// expectedOutputs[i] must equal the REAL eval(circuitId, abi.encodePacked(uint8(i)))
    /// result, for every i in [0, 2^nIn). Required and checked only when
    /// nIn <= MAX_ONCHAIN_VERIFY_INPUTS; for larger nIn pass an empty array and rely on
    /// proofHash alone (attestation only, NOT independently checked here - BUILD.md 4.3).
    function submit(
        bytes32 specHash,
        address processor,
        uint256 circuitId,
        uint8 nIn,
        uint8 nOut,
        uint32 gates,
        uint32 depth,
        bytes[] calldata expectedOutputs,
        bytes32 proofHash
    ) external {
        uint256 newC = cost(gates, depth);
        Entry memory cur = best[specHash];
        if (cur.processor != address(0) && newC >= cost(cur.gates, cur.depth)) {
            revert NotStrictlyBetter();
        }

        bool verified = false;
        if (nIn <= MAX_ONCHAIN_VERIFY_INPUTS) {
            uint256 width = uint256(1) << nIn;
            if (expectedOutputs.length != width) revert BadExpectedOutputsLength();
            for (uint256 i = 0; i < width; i++) {
                bytes memory inp = abi.encodePacked(uint8(i));
                bytes memory got = IProcessor(processor).eval(circuitId, inp);
                if (keccak256(got) != keccak256(expectedOutputs[i])) revert VerificationFailed(i);
            }
            verified = true;
        }

        best[specHash] = Entry(processor, circuitId, gates, depth, nIn, nOut, verified, proofHash, msg.sender);
        emit Registered(specHash, processor, circuitId, gates, depth, newC, msg.sender, verified);
    }
}
