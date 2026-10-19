> SUPERSEDED (2026-10-19): priced against OrderGuard (0x57F3...a355), a processor never shown to be linked to real FabX PoD rewards. Use docs/COSTS.md (priced against the CONFIRMED FAB_TST processor) instead. Kept here for history, not deleted.

# 2.4: tape-out dry run (real calldata, real fees; gas blocked on a real on-chain gate)

## ABI (found + verified, not guessed)
Found in xm1319/tapemkt's own `xl-tapeout.js` deployment script (the ecosystem's own real
tape-out tool): processor `tapeout(bytes nl, uint32 nIn, uint32 nOut) payable returns (uint256)`,
`TAPEOUT_FEE() view returns (uint256)`, `transistors() view returns (address)`; the transistors
contract (ERC1155-based): `mint(uint256 id, uint256 amount) payable`, `mintPrice()`,
`protocolFee()`, `supplyCap()`, `minted()`. All re-verified live against the real deployed
OrderGuard processor on an X Layer fork:
- `TAPEOUT_FEE()` = 1,300,000,000,000,000 wei = **0.0013 OKB** (matches BUILD.md exactly)
- transistors @ 0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e: `mintPrice()` = 100,000,000,000,000
  wei = **0.0001 OKB**, `protocolFee()` = 660,000,000,000,000 wei = **0.00066 OKB**,
  `supplyCap()`=10000, `minted()`=42. All three fee figures from BUILD.md section 3 are now
  independently re-confirmed live (upgraded from "seen/reported" to directly verified), and
  committed to config/cost.ts as `ORDERGUARD_FEES`.

## Real, independently-verified calldata for 8 circuits (top-5 beats by q + 3 representative ties)
packages/core/scripts/dry_run_tapeout.ts combines each task's per-output optimized netlist into
one multi-output TAP-02 netlist (each output's own 2 buffer NANDs appended, matching the
convention xl-tapeout.js itself uses - submitter encodes the buffers, not the contract), using
core's own serialize(). packages/core/scripts/verify_combined.py independently re-simulates
every combined netlist (from-scratch Python NAND interpreter) against the REAL fetched vectors
for all outputs jointly - **0/8 mismatches** (this caught and fixed a real bug in the first
version of the combine() offset math, where each block's offset was computed from its full gate
count instead of gate-count-minus-one, since each block's final gate moves to the global end;
single-output tasks masked the bug, which only showed up once nOut>1).

| task | nIn/nOut | gates (incl. buffers) | bytes | mint cost (OKB) | tape-out fee (OKB) | total (OKB) |
|---|---|---|---|---|---|---|
| 12 | 4/4 | 56 | 392 | 0.00626 | 0.0013 | 0.00756 |
| 46 | 8/4 | 92 | 644 | 0.00986 | 0.0013 | 0.01116 |
| 45 | 8/4 | 93 | 651 | 0.00996 | 0.0013 | 0.01126 |
| 43 | 8/4 | 181 | 1267 | 0.01876 | 0.0013 | 0.02006 |
| 44 | 8/4 | 85 | 595 | 0.00916 | 0.0013 | 0.01046 |
| 1 | 1/1 | 3 | 21 | 0.00096 | 0.0013 | 0.00226 |
| 8 | 3/1 | 8 | 56 | 0.00146 | 0.0013 | 0.00276 |
| 20 | 3/2 | 17 | 119 | 0.00236 | 0.0013 | 0.00366 |
| **total (all 8)** | | **535** | | **0.05878** | **0.0104** | **0.06918** |

## Gas: blocked on a real, confirmed on-chain precondition (not a bug, not guessed around)
`tapeout()` itself cleanly reverts `ERC1155InsufficientBalance(sender, have=0, needed=<gates>,
id=0)` when the caller holds no transistors - confirming the real mechanism (buy >=gateCount
transistors before taping out), exactly as xl-tapeout.js's own flow shows. But minting those
transistors to a plain funded EOA (anvil's well-known public dev account, fork-only, never a
real key) reverts with `ERC1155InvalidReceiver(<the EOA>)` - confirmed NOT an argument-order or
wrong-id issue (cross-checked: swapping args gives a distinct "bad id" revert instead; id=0 and
id=1 both hit the same InvalidReceiver). This points to mint() being gated behind something
beyond a funded EOA - most likely requiring ownership of the FAB-Genesis NFT BUILD.md section 3
already names as a separate contract, or an allowlist - but which one is UNVERIFIED; not
chased further within this session's scope (would require also understanding Genesis NFT
minting mechanics). **No gas number is reported for the full mint+tapeout flow; reporting a
guessed one would violate BUILD.md rule 3.** The calldata and fee table above are real and
usable regardless of this gap.
