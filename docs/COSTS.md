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
