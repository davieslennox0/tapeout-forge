# TapeOut and FabX: what changed, and what it means for this project (research, 2026-10-26)

Scope: read-only. Primary sources are the live FabX API (`api.fabx.tech/v1/...`, the same endpoints the replay was built from) and direct X Layer reads. Web search returned only secondary crypto press, and the fetch tool could not reach `fabx.tech`, `tapeout.net`'s content (a 544-byte JavaScript shell) or the hackathon page, so announcements and the hackathon rules were **not** re-verified.

## What the live data shows

| item | 2026-10-16 to 10-19 (our notes) | 2026-10-26 (live) | source |
|---|---|---|---|
| FabX task bank | 100 tasks (54 combinational, 46 sequential) | identical: 100 tasks, **no added or removed task, no differing field** versus our committed snapshot | `/v1/pod/taskbank` vs `docs/fabx-tasks.json` |
| PoD global state | owner `0xfb77...5Ef8`, 7,200 $FAB/day | same owner; 100 tasks; 6,583 miners (6,470 verified); `currentRate` 8,333,333 (raw units; 7,200/day if 8 decimals, decimals not checked) | `/v1/pod/state` |
| PoD processor multipliers | one processor (FAB_TST `0x87bf...f9a6`) at 6 | FAB_TST still 6; a second address `0x265E...3c` ("RefBench") at **0** | `/v1/pod/state`, `name()` read |
| TapeOut on X Layer | 208 processors, 1,176 circuits (RECON.md in the separate public nandout repository, 2026-10-16) | **396 processors, 11,340 circuits**, 5,198 mint txs, about 3,103 OKB total mint volume | `/v1/tapeout/registry-stats`, `/protocol-stats` |
| Factory `0x1f09...0761` | `isSealed() == false` | still false; implementation `0xb41C1E7602EB5734BE2430b72178ccb814A5293d` (first time recorded, no earlier value to compare) | `isSealed()`, EIP-1967 slot |
| OrderGuard (our processor) | cap 10,000, mint 0.0001 OKB, tape-out fee 0.0013, protocol fee 0.00066 | unchanged; 376 minted of 10,000 | direct reads |
| Our registry | v1 only | v2 deployed 2026-10-26 (docs/TAPEOUTS.md) | chain |

Secondary press (KuCoin and others, not verified here) says TapeOut began on BNB Chain in August 2026 with a $BEM token and "Proof of Design" mining; X Layer appears here only through FabX's `api.fabx.tech` and the on-chain stats above.

## Impact on the work already done

1. **Replay and the headline claims are unaffected.** The task bank (references, vectors roots, K, Cref) is byte-for-byte the one we replayed: beat 22, tie 11, lose 13 of the 46 complete-spec tasks still stand.
2. **One documentation error found and fixed.** The tasks that were not replayed are 8 wide-input combinational tasks (9 to 18 inputs) plus the 46 sequential ones, 54 in total, not "44 wide-input plus 46 sequential" (which adds up to 90). Fixed in docs/FABX-REPLAY.md, its generator `fabx-replay-v2.ts` and docs/SUBMISSION.md.
3. **No reward claim is affected, and none is made.** Our five showcase circuits are on OrderGuard, which is not a PoD processor, so nothing here earns $FAB. The new multiplier-0 processor changes nothing for us.
4. **We only claim to beat the reference, not the current best.** Miners may already hold better designs for these tasks; the task endpoint exposes no best-design field, so we could not compare, and the README and site never say we beat the incumbent.
5. **The protocol grew about tenfold in circuits in ten days**, so more competing circuits and tooling exist than when the project was scoped; our tooling's value is unchanged, but any "no one else does this" wording would be unsupported (none is used).
6. **The factory is still not sealed**, so `eval` for every processor can still be upgraded by its owner. This is now stated in docs/SUBMISSION.md. It does not change our netlists (immutable) but it limits how long the on-chain "verified" results are meaningful.
7. **Costs are unchanged**, and OrderGuard has plenty of mint headroom, so the scripts and the cost model need no update.

## Not verified

- Hackathon dates, required submission fields and judging criteria (re-check the official page before submitting; BUILD.md section 2 marks the end date provisional).
- Any TapeOut or FabX announcement after 2026-10-19 beyond what the live data above implies.
- Whether other miners have already registered better designs for our 22 tasks.
