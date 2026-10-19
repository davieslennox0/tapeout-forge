# Real costs (CURRENT: OrderGuard, Phase 7 retarget — supersedes the FAB_TST re-pricing below and docs/TAPEOUT-DRYRUN.md)

Phase 6 found FAB_TST's transistor supply exhausted with no acquisition route
(docs/ACQUIRE-AND-CLAIM.md). Phase 7 retargets go-live to OrderGuard
(`0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`), which has real transistor-supply headroom.
This is now the authoritative cost table for the hackathon go-live plan.

## Real fee parameters (fresh eth_call, 2026-10-19)

- OrderGuard `name()` = "OrderGuard" (live, not copied from any doc).
- Transistor contract `0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e`:
  `supplyCap()`=10,000, `minted()`=42 (re-verified, unchanged from earlier measurements),
  `mintPrice()`=100,000,000,000,000 wei=**0.0001 OKB**, `protocolFee()`=660,000,000,000,000
  wei=**0.00066 OKB**.
- `TAPEOUT_FEE()`=1,300,000,000,000,000 wei=**0.0013 OKB**.

## Final circuit list (all re-confirmed strictly better than reference, gallery.full.json)

| task | nIn/nOut | gates (incl. buffers) | depth* | Cref | C | q |
|---|---|---|---|---|---|---|
| GC-012 | 4/4 | 56 | 8 | 496,000 | 28,672 | 4.000 |
| GC-037 | 4/4 | 36 | 9 | 63,936 | 26,244 | 2.436 |
| GC-050 | 4/8 | 46 | 7 | 43,000 | 15,778 | 2.725 |
| GC-039 | 6/6 | 119 | 12 | 576,000 | 205,632 | 2.801 |
| GC-046 | 8/4 | 92 | 10 | 367,416 | 92,000 | 3.994 |

\*depth derived from the already-verified C=gates×depth³ formula (all five are exact integer
cube roots of C/gates) — not independently re-measured this session; gallery.full.json has no
depth field, so this is the correct value to pass to ForgeRegistry.submit(), not 0 (see the
fork-test note below).

## Real fee totals (OrderGuard)

| task | mint (gates×0.0001+0.00066) | tapeout fee | **total OKB** |
|---|---|---|---|
| GC-012 | 0.00626 | 0.0013 | **0.00756** |
| GC-037 | 0.00426 | 0.0013 | **0.00556** |
| GC-050 | 0.00526 | 0.0013 | **0.00656** |
| GC-039 | 0.01256 | 0.0013 | **0.01386** |
| GC-046 | 0.00986 | 0.0013 | **0.01116** |
| **sum (5)** | | | **0.0447** |

Transistors needed: 56+36+46+119+92 = **349**. Real supply headroom: 10,000 cap − 42 minted =
9,958 available now; after minting 349 for these 5, 9,609 would remain. Well within range.

## Real Anvil-fork test (2026-10-19, impersonated test address, never the real chain)

Deployed a fresh ForgeRegistry on the fork (460,958 gas — matches the earlier Phase 5
measurement exactly). For each circuit: mint → tapeout (real event-decoded circuit id) →
register. All 5 succeeded end to end.

| task | mint gas | tapeout gas | register gas | circuitId | onchainVerified |
|---|---|---|---|---|---|
| GC-012 | 86,399 | 377,599 | 2,358,024 | 6 | **true** |
| GC-037 | 86,399 | 303,698 | 1,638,753 | 7 | **true** |
| GC-050 | 86,399 | 332,175 | 2,022,060 | 8 | **true** |
| GC-039 | 86,399 | 538,903 | 18,191,899 | 9 | **true** |
| GC-046 | 86,399 | 462,442 | 119,099 | 10 | **false** (attestation path, by design — nIn=8 > MAX_ONCHAIN_VERIFY_INPUTS=6) |

GC-039 (nIn=6) confirms the on-chain-verify path works at the real n=6 boundary, not just small
n. GC-046 correctly falls through to the attestation-only path exactly as
`contracts/src/ForgeRegistry.sol` designs it — `registry.best(specHash).onchainVerified` reads
`false`, storage otherwise populated normally. `registry.best()`'s real field order (confirmed
from source, not guessed): `(address processor, uint256 circuitId, uint32 gates, uint32 depth,
uint8 nIn, uint8 nOut, bool onchainVerified, bytes32 proofHash, address submitter)` — this
fork test passed `depth=0` (a gap in the test driver, not a contract defect); use the real
derived depth values in the table above for any real submission.

**One fork-test mistake caught and fixed before trusting any result**: the first attempt to
deploy ForgeRegistry used a broken `forge inspect` invocation that silently produced empty
bytecode; the resulting "deployment" and all 5 register calls against it looked like they
succeeded (status 1) but were against a contract with zero code. Caught by checking
`eth_getCode` before trusting any gas number, redone properly with `forge create`.

---

# Real costs (CONFIRMED processor, FAB_TST — supersedes docs/TAPEOUT-DRYRUN.md)

Priced against the real, CONFIRMED FabX PoD processor `0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6`
(see docs/PROCESSOR-EVIDENCE.md), fresh `eth_call`s on 2026-10-19, NOT the old OrderGuard
(`0x57F3...a355`) table — that table priced the wrong processor and is marked SUPERSEDED.

## Real fee parameters (eth_call, just now)

- `name()` = "FAB-Genisis" — re-confirmed live, independent of docs/config.
- `TAPEOUT_FEE()` = 1,300,000,000,000,000 wei = **0.0013 OKB** (same as OrderGuard).
- `transistors()` = `0xBe6f94115D32f3AC3252bc4626573e739bEeb714` — **this is the SAME address
  already identified elsewhere in this project as the FAB-Genesis NFT contract.** FAB_TST's
  "transistors" and "FAB-Genesis NFT" are not two separate contracts; they are one. This is a
  new structural fact, not previously documented this explicitly.
- On that contract: `mintPrice()` = 500,000,000,000,000 wei = **0.0005 OKB** — DIFFERENT from
  OrderGuard's transistors contract (0.0001 OKB). Do not reuse the old number.
- `protocolFee()` = 660,000,000,000,000 wei = **0.00066 OKB** (same as OrderGuard).

## CRITICAL BLOCKER (real, current, confirmed): transistor supply is exhausted

`supplyCap()` = `minted()` = **1,000,000 = 1,000,000**. A live static-call simulation of
`mint(0, 1)` from a plain funded EOA reverts with the EXACT real reason `"supply cap"`
(revert data decoded: `0x08c379a0...` → `"supply cap"`). **No new transistors can currently be
minted by anyone, including a brand-new wallet**, on the real chain, right now. This directly
blocks docs/GO-LIVE.md's planned flow (step 1: "create a NEW wallet" — a new wallet holds 0
transistors and cannot acquire any by minting).

The only way to tape out right now is to already hold transistors (bought/transferred, not
minted) in sufficient quantity. Two real addresses checked (both from real on-chain claim
senders in docs/PROCESSOR-EVIDENCE.md): `0x0ee61d...00989` holds 0; `0x93d037...3b9ab` holds 3
— far short of any of the 5 beats below (56-181 needed). No address with sufficient balance was
found in this session's effort.

## tapeout() ABI: confirmed identical shape to OrderGuard's

A live `eth_call` to `tapeout(bytes,uint32,uint32)` with GC-012's real full netlist hex (not a
truncated one) reverted with a clean custom-error (selector `0x03dee4c5`), not an
argument-decode panic — decoded: `(sender, id=0, have=0, needed=56)`. 56 matches GC-012's known
real gate count exactly. This confirms the function signature and argument encoding are
identical to OrderGuard's; **only the transaction's `to` address changes** between the two
processors for an otherwise-identical tape-out call.

## Recomputed cost table (5 beats), using the REAL new fee numbers

Fee math only — see the blocker above for why "mint cost" is currently unpayable by anyone
lacking existing balance, not just a number to budget for.

| task | gates (incl. buffers) | mint cost (gates × 0.0005 OKB) | protocol fee | tape-out fee | **total OKB** |
|---|---|---|---|---|---|
| GC-012 | 56 | 0.0280 | 0.00066 | 0.0013 | **0.02996** |
| GC-046 | 92 | 0.0460 | 0.00066 | 0.0013 | **0.04796** |
| GC-045 | 93 | 0.0465 | 0.00066 | 0.0013 | **0.04846** |
| GC-043 | 181 | 0.0905 | 0.00066 | 0.0013 | **0.09246** |
| GC-044 | 85 | 0.0425 | 0.00066 | 0.0013 | **0.04446** |
| **total (5)** | 507 | | | | **0.2633** |

**Spend cap** (per BUILD.md's Phase 5 rule, total × 1.2): **0.31596 OKB** — but this cap is
moot until the mint blocker above is resolved; it cannot actually be spent via minting today.

## Gas measurement: NOT obtained, reported honestly rather than guessed

Attempted on a real Anvil fork of X Layer. Could not grant a test account sufficient transistor
balance to get `tapeout()` past the balance check: (a) real holders checked had far too little
balance (0 and 3); (b) attempted an `anvil_setStorageAt` cheat to directly grant balance,
brute-forcing 10 candidate storage slots for the standard OpenZeppelin ERC1155
`_balances[id][account]` nested-mapping layout — all read back as zero, meaning this contract
does not use that exact standard layout (no source available to determine the real one).
**No fabricated gas number is reported.** The old OrderGuard-era numbers
(docs/NEW.md's mint-diagnosis entry, task12=382399 gas etc.) are for a DIFFERENT processor and
must not be reused as a stand-in for FAB_TST's real cost — the two are confirmed to share the
same ABI shape, so the real number is *likely* similar, but "likely similar" is not "measured,"
and BUILD.md forbids reporting a guessed number as fact.

## Status of docs/TAPEOUT-DRYRUN.md

That file's cost table is **SUPERSEDED** — it was priced against OrderGuard, a processor never
shown to be linked to real FabX PoD rewards (see docs/PROCESSOR-EVIDENCE.md). A marker has been
added to the top of that file; its content is kept for history, not deleted.

## 7.4 — own-processor option (read-only research; document only, nothing built or called)

Factory address with a real primary-source citation: `0x1f09DAeFA827f02CBb40967cc91b259763760761`
("Processor factory"), sourced from github.com/TapeOutProtocol/TapeKit's own README (fetched via
`gh api repos/TapeOutProtocol/TapeKit/readme`, already cited in docs/DEWEB-RESEARCH.md — same
citation, not reused from memory). Confirmed real on-chain: `eth_getCode` returns non-empty,
proxy-shaped bytecode (embeds the EIP-1967 implementation-slot constant). `name()` reverts
(consistent with being a factory, not a named processor/token itself).

**UNVERIFIED beyond that**: the exact creation-function ABI and fee, and whether a newly-created
processor gets its own fresh transistor token or shares an existing one. The EIP-1967
implementation slot read back as unset (zero) via a direct `eth_getStorageAt`, and three plausible
read-only selector guesses (`0x25e16063`, `0x18160ddd`, `0xc4d66de8`) all reverted with no data —
no further probing was done past this point (BUILD.md's own rule: stop and report rather than
guess indefinitely). TapeKit's README documents this address in the context of its DeWEB/container
flow, not a TapeOut-protocol processor-creation guide specifically, so it may simply be the wrong
document to source a creation ABI from. **Conclusion: creating your own processor is a real,
cited, on-chain-confirmed-to-exist option, but its cost and mechanics are not established here —
treat as a research TODO for the owner, not a ready path, unless/until someone finds the actual
TapeOut Protocol factory documentation (not TapeKit's).**
