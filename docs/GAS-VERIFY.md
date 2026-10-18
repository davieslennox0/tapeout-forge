# 2.3: ForgeRegistry - ABI verification + real gas measurements (n=3..6, on an X Layer fork)

## ABI re-verified on a read-only anvil fork (`anvil --fork-url https://rpc.xlayer.tech`)
`eval(uint256,bytes)` selector 0x934d06ea, `circuitInfo(uint256)` selector 0x084d60f1 (returns
nIn,nOut,nState,gateCount), `netlist(uint256)` selector 0x3fc4be56 - all three called directly
against the real deployed OrderGuard processor on the fork and returned exactly the shapes
already VERIFIED in Phase 1b/1c (e.g. circuitInfo(1) -> (2,1,0,3), matching netlist(1)'s 21-byte
= 3-gate payload). Confirms the prior ABI findings hold on a forked, not just live, read.

## Contract
contracts/src/ForgeRegistry.sol - ownerless (no admin/owner state, no pause, no upgrade path).
specHash -> Entry{processor, circuitId, gates, depth, nIn, nOut, onchainVerified, proofHash,
submitter}. submit() rejects any replacement that isn't strictly cheaper (cost = gates *
max(depth,1)^3); for nIn<=6 it independently re-verifies every one of the 2^nIn rows by calling
the REAL processor's eval() and comparing bytes, reverting on the first mismatch; above nIn=6 it
accepts only an attestation (proofHash), never independently checked on-chain.

## Tests (contracts/test/ForgeRegistry.t.sol), all passing against the real fork
- test_AcceptsRealVerifiedCircuit_MAJ3_n3 - accepts a real, correctly-verified circuit (FAB_TST
  id=65, the known 6-gate MAJ3).
- test_RejectsNonEquivalentSubmission - a single corrupted expected-output row reverts
  VerificationFailed, not silently accepted.
- test_RejectsNonImprovement - equal-or-worse cost on an existing entry reverts NotStrictlyBetter
  (checked for both an exact tie and a strictly worse resubmission).
- test_AcceptsStrictImprovement - a strictly cheaper verified circuit replaces an existing entry.

## Real gas measurements (forge test -vv against the fork, real FAB_TST circuits)
| nIn | width | circuit id | nOut | gates | submit() gas | gas/row |
|---|---|---|---|---|---|---|
| 3 | 8 | 65 | 1 | 6 | 342,856 | 42,857 |
| 4 | 16 | 68 | 1 | 10 | 690,567 | 43,160 |
| 5 | 32 | 128 | 1 | 23 | 2,190,727 | 68,460 |
| 6 | 64 | 85 | 6 | 45 | 7,556,637 | 118,072 |

(FAB_TST address is only correlation-matched per BUILD.md section 3 - used here purely as a
real contract for gas measurement, not as a labeled submission. No nIn=7+/nOut=1 circuit was
found among ids 1-220 scanned to extend the single-output series further.)

Per-row cost grows with circuit size, not just width (consistent with BUILD.md's own
eval()-gas model, ~43,783 fixed + ~1,952/gate: a 23-gate eval alone predicts ~88,679 gas, in the
same range as the observed ~68,460/row at n=5). The real X Layer block gas limit right now
(`cast block latest --field gasLimit`) is **210,000,000**. Even n=6 here used only ~3.6% of a
block in one transaction.

## n-limit decision
Set `MAX_ONCHAIN_VERIFY_INPUTS = 6` (as implemented), based on the measured data only -
extrapolation beyond n=6 is NOT verified and not relied on. 6 keeps a single submit() transaction
well under 4% of the current block limit with real circuits, leaving comfortable headroom for
larger circuits at the same nIn and for gas-price volatility, while not claiming safety at n=7+
without real measurements there.
