# Acquiring transistors and submitting for PoD scoring (read-only investigation)

Everything below is read-only on the real chain; all behavioral tests ran on a local Anvil
fork with impersonated addresses (`anvil_setBalance` / `anvil_impersonateAccount`). No
transaction was ever broadcast to the real chain, no private key was used anywhere.

## Decision for the owner: two paths

**(A) Buy-transistors path — blocked, no acquisition route found.** FAB_TST's transistor
supply is fully exhausted (`supplyCap()==minted()==1,000,000`, re-confirmed live). No new
transistors can be minted by anyone, including a brand-new wallet. This investigation could
not find where existing transistors can be bought: no DEX pool or marketplace listing for this
token was found within this session's scope (not an exhaustive search of every possible venue
— just nothing turned up). The 4 real historical participants checked now hold either 0 or 3
transistors each — nowhere near the 507 needed for the 5 priced beats, and no incoming
transfer event was found in the 100 blocks immediately before or during any of their real
on-chain actions (the RPC's hard 100-block-per-call limit makes a full historical trace back to
their original acquisition impractical in reasonable time — not ruled out, just not reachable
this session). **If you want to pursue this path: ask in FabX's own community/Discord/socials
directly whether a secondary market for transistors exists at all** — this investigation found
no public one.

**(B) Own-or-other-processor path — real, available today.** OrderGuard
(`0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`) has its own, separate, NOT-exhausted transistor
contract (`0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e`, cap 10,000 / 42 minted — plenty of
headroom, mint price 0.0001 OKB/unit). This satisfies the hackathon's own stated requirement
("must use TapeOut circuits, contracts or onchain data on X Layer" — BUILD.md section 2) since
OrderGuard is a real, independently-verified TAP-02 processor. It does **not** target FabX's
real PoD mining rewards (OrderGuard has never been shown to be FabX-PoD-linked — see
docs/PROCESSOR-EVIDENCE.md), only the hackathon's own submission requirements. Real cost for
the 5 beats on OrderGuard (docs/TAPEOUT-DRYRUN.md, SUPERSEDED-for-FAB_TST-purposes table, still
valid for OrderGuard itself): **0.06918 OKB total for all 8 priced circuits** (cheaper than
FAB_TST's 0.2633 OKB for just 5, since OrderGuard's mint price is 0.0001 vs FAB_TST's 0.0005
OKB/unit) — and mintable today, with no supply blocker.

**What the owner must do by hand for path (B)**: fund a wallet with ~0.08 OKB (0.06918 + margin
for gas), run `scripts/check-wallet.sh`, then `scripts/tapeout.sh` for each of the 8 circuits
targeting OrderGuard (the scripts already default to OrderGuard-shape calldata — confirm the
`to` address before broadcasting). This satisfies the hackathon submission requirement. It does
**not** earn real FabX PoD rewards — be clear about that distinction in any submission
materials, per BUILD.md's own honesty rule.

---

## 6.1 — Supply facts reconciled (two different contracts, don't mix the numbers)

| | FAB_TST's transistor contract | OrderGuard's transistor contract |
|---|---|---|
| Address | `0xBe6f94115D32f3AC3252bc4626573e739bEeb714` (same contract as the FAB-Genesis NFT — confirmed, not two separate contracts) | `0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e` |
| `supplyCap()` | 1,000,000 | 10,000 |
| `minted()` | 1,000,000 (**exhausted**) | 42 |
| `mintPrice()` | 0.0005 OKB/unit | 0.0001 OKB/unit |
| mint function | `mint(uint256 id, uint256 amount) payable` | same shape |

All four numbers re-confirmed live via fresh `eth_call`s during this investigation (not just
read from an earlier doc). `docs/USER-STEPS.md` previously cited "10,000 cap / 42 minted"
without saying which processor that was for — it was OrderGuard's, not FAB_TST's. Corrected in
`docs/USER-STEPS.md` (this commit).

## 6.2 — Acquisition routes: real findings, with an honest gap

Four of the five real claimants from `docs/PROCESSOR-EVIDENCE.md` were traced by address
(the fifth routes through ERC-4337's EntryPoint with an aggregated-signature bundle too complex
to cleanly attribute to a single underlying smart-account address within this session's scope):

| address | current FAB_TST transistor balance (id=0) | incoming transfer found in the 100 blocks before/during their real on-chain action? |
|---|---|---|
| `0x63efe20b012d9ccd124ac1ff5df062c95d061ea1` | 0 | no |
| `0x9492f1031fef8b603c4386a6c2c48f33677c2788` | 0 | no |
| `0x0ee61d7e98328d285779be0d694b83dcb2f00989` | 0 | no |
| `0x93d037c5e6632590f6c18ad16a9689657cb3b9ab` | 3 | no |

No mint-from-zero or transfer-in event was found for any of them in the 100-block window the
RPC allows per call, immediately before or during their real transaction's own block. This
means they acquired whatever they held notably earlier than that window — genuinely not
traceable further back within this session, since `eth_getLogs` on this RPC hard-caps at 100
blocks per call and a full-history scan (potentially millions of blocks) wasn't feasible in
reasonable time as a single-pass investigation. **This is reported as a real gap, not papered
over**: a future session with more RPC budget (or a different RPC/indexer without the 100-block
cap, e.g. a dedicated indexing service) could extend this trace.

**No 20-largest-holders list could be produced** for the same reason — enumerating ERC1155
holders requires scanning the token's entire transfer history, which this RPC's 100-block cap
makes impractical to do exhaustively in one session. **No DEX pool or marketplace listing for
this token was found** within the scope actually checked (FabX's own frontend bundles, which
were already found in the earlier processor-evidence investigation to contain zero hardcoded
addresses at all — everything comes from the API at runtime, not something to grep further).

**Transistors needed for the 5 priced beats**: **507** (GC-012:56 + GC-046:92 + GC-045:93 +
GC-043:181 + GC-044:85), from `docs/COSTS.md`.

## 6.3 — Claim gating, empirically tested — and a real correction to the premise

**Correction first**: the 5 "claim transactions" named in `docs/PROCESSOR-EVIDENCE.md` are not
reward claims. Decoding their real function/event selectors via a public signature database:
- `0xc7b21b6c` = `commitDesign(address,bytes32)` — this is BUILD.md's own documented tie-break
  commit mechanism (for exact-cost ties), unrelated to claiming a reward.
- `0xa3494614` = `start(address,uint256,uint32,uint256,bytes[],bytes[],bytes32[][],bytes32)`
- The log event emitted, topic0 `0x7c9c1f2b...`, is named **`Started(bytes32,address,uint256,uint32,address,uint64,uint64,bool,uint256,uint256,uint32)`** —
  not `Claimed` or anything reward-sounding.

So what actually happens on-chain is **task submission/scoring registration** (`start()`), not
a separate reward-claim step. Whether a distinct reward-claim function exists elsewhere on this
contract, or rewards distribute automatically after scoring, was not determined this session —
flagged UNVERIFIED rather than assumed either way.

**Empirical fork tests on `start()`** (forked at block 73622205, the block before a real
`start()` call, tx `0x3586e2b9e54a1cd6c23bf86765ba47ef075e3c73ca28f497776db1945c5ecfc1`):

1. **Replayed from the original real sender** (`0x93d037c5e6632590f6c18ad16a9689657cb3b9ab`,
   impersonated, exact same calldata): **succeeded**, `status: 1`, real `Started` event
   emitted, gas used 220,344. Confirms the fork/calldata setup is faithful.
2. **Replayed the identical calldata from a fresh, unrelated, funded address**
   (`0x1111...1111`, impersonated, funded via `anvil_setBalance`): **reverted** with a decoded
   custom error **`Ownr()`** (selector `0xa8ee9629`). This is a real, concrete finding: `start()`
   requires the caller to own something — almost certainly the specific circuit/task being
   submitted — not an NFT, not a stake, not a fee amount. A fresh wallet with no relationship to
   the circuit cannot submit it for scoring.
3. **Genesis-NFT-holder-vs-not comparison**: not separately run. The `Ownr()` result from test 2
   already identifies the real gate (circuit ownership), making the NFT question moot for this
   specific function — but this project cannot say with certainty that NFT ownership plays
   *zero* role elsewhere in the flow; only that it isn't what caused the fresh-address revert
   observed here. Flagged as a real limitation of this pass, not claimed as fully ruled out.

## 6.4 — One real end-to-end fork test (GC-012, as asked — result was a real block, not forced)

Impersonated `0x93d037c5e6632590f6c18ad16a9689657cb3b9ab` (a real historical `start()` sender,
holding 3 real FAB_TST transistors) on the same fork, and attempted to tape out this project's
own verified GC-012 netlist (real calldata, selector `0x7bd3ac1d`, from
`apps/web/src/data/gallery.full.json`) on FAB_TST, with the real 0.0013 OKB tape-out fee
attached.

**Result: reverted**, with the exact real decoded error `ERC1155InsufficientBalance(sender=0x93D0...9aB, have=3, needed=56, id=0)`.

This is the honest outcome, not a forced success: this real address's own current transistor
balance (3) is far short of GC-012's real requirement (56). The chain of custody "tape out →
submit for scoring" could not proceed past the very first step for this address, with its real
current on-chain state — which is itself the concrete, lived confirmation of the 6.1/6.2 supply
blocker: even a genuine past protocol participant cannot tape out a new circuit today without
acquiring more transistors from somewhere this investigation could not identify.
