// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForgeRegistry, IProcessor} from "../src/ForgeRegistry.sol";

/// BUILD.md 2.3: real deployed processors on an X Layer fork (read-only; no transactions).
/// FAB_TST address is only correlation-matched per BUILD.md section 3 - used here purely as
/// a real contract for gas measurement, not as a labeled submission.
contract ForgeRegistryTest is Test {
    ForgeRegistry registry;
    address constant ORDERGUARD = 0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355;
    address constant FAB_TST = 0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6;

    function setUp() public {
        registry = new ForgeRegistry();
    }

    function buildExpected(address proc, uint256 id, uint8 nIn) internal view returns (bytes[] memory out) {
        uint256 width = 1 << nIn;
        out = new bytes[](width);
        for (uint256 i = 0; i < width; i++) {
            out[i] = IProcessor(proc).eval(id, abi.encodePacked(uint8(i)));
        }
    }

    function test_AcceptsRealVerifiedCircuit_MAJ3_n3() public {
        bytes[] memory expected = buildExpected(FAB_TST, 65, 3);
        registry.submit(keccak256("maj3-test"), FAB_TST, 65, 3, 1, 6, 4, expected, bytes32(0));
        (,, uint32 gates,,,, bool verified,,) = registry.best(keccak256("maj3-test"));
        assertEq(gates, 6);
        assertTrue(verified);
    }

    function test_RejectsNonEquivalentSubmission() public {
        bytes[] memory expected = buildExpected(FAB_TST, 65, 3);
        expected[0] = abi.encodePacked(uint8(0xFF)); // corrupt one row
        vm.expectRevert(abi.encodeWithSelector(ForgeRegistry.VerificationFailed.selector, 0));
        registry.submit(keccak256("maj3-bad"), FAB_TST, 65, 3, 1, 6, 4, expected, bytes32(0));
    }

    function test_RejectsNonImprovement() public {
        bytes[] memory expected = buildExpected(FAB_TST, 65, 3);
        // first submission: gates=6, depth=4 -> C=6*64=384
        registry.submit(keccak256("maj3-replace"), FAB_TST, 65, 3, 1, 6, 4, expected, bytes32(0));
        // second submission with equal cost (same gates/depth) must be rejected (not strictly better)
        vm.expectRevert(ForgeRegistry.NotStrictlyBetter.selector);
        registry.submit(keccak256("maj3-replace"), FAB_TST, 65, 3, 1, 6, 4, expected, bytes32(0));
        // worse cost also rejected
        vm.expectRevert(ForgeRegistry.NotStrictlyBetter.selector);
        registry.submit(keccak256("maj3-replace"), FAB_TST, 65, 3, 1, 8, 6, expected, bytes32(0));
    }

    function test_AcceptsStrictImprovement() public {
        bytes[] memory expected = buildExpected(FAB_TST, 65, 3);
        // first: worse-looking entry (gates=8,depth=6 -> C=8*216=1728), same real circuit/outputs
        registry.submit(keccak256("maj3-improve"), FAB_TST, 65, 3, 1, 8, 6, expected, bytes32(0));
        // then: strictly better (gates=6,depth=4 -> C=384) with the SAME real verified outputs - must succeed
        registry.submit(keccak256("maj3-improve"), FAB_TST, 65, 3, 1, 6, 4, expected, bytes32(0));
        (,, uint32 gates,,,,,,) = registry.best(keccak256("maj3-improve"));
        assertEq(gates, 6);
    }

    // --- BUILD.md 2.3: gas measurement for n=3..6 on the fork, real circuits, logged to stdout ---
    function test_GasMeasurement_n3() public {
        bytes[] memory expected = buildExpected(FAB_TST, 65, 3); // nIn=3, nOut=1, gates=6
        uint256 g0 = gasleft();
        registry.submit(keccak256("gas-n3"), FAB_TST, 65, 3, 1, 6, 4, expected, bytes32(0));
        emit log_named_uint("gas n=3 (width=8, circuit id=65, gates=6)", g0 - gasleft());
    }

    function test_GasMeasurement_n4() public {
        bytes[] memory expected = buildExpected(FAB_TST, 68, 4); // nIn=4, nOut=1, gates=10
        uint256 g0 = gasleft();
        registry.submit(keccak256("gas-n4"), FAB_TST, 68, 4, 1, 10, 0, expected, bytes32(0));
        emit log_named_uint("gas n=4 (width=16, circuit id=68, gates=10)", g0 - gasleft());
    }

    function test_GasMeasurement_n5() public {
        bytes[] memory expected = buildExpected(FAB_TST, 128, 5); // nIn=5, nOut=1, gates=23
        uint256 g0 = gasleft();
        registry.submit(keccak256("gas-n5"), FAB_TST, 128, 5, 1, 23, 0, expected, bytes32(0));
        emit log_named_uint("gas n=5 (width=32, circuit id=128, gates=23)", g0 - gasleft());
    }

    function test_GasMeasurement_n6() public {
        bytes[] memory expected = buildExpected(FAB_TST, 85, 6); // nIn=6, nOut=6, gates=45
        uint256 g0 = gasleft();
        registry.submit(keccak256("gas-n6"), FAB_TST, 85, 6, 6, 45, 0, expected, bytes32(0));
        emit log_named_uint("gas n=6 (width=64, circuit id=85, nOut=6, gates=45)", g0 - gasleft());
    }
}
