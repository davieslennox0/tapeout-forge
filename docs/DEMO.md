# Demo script (BUILD.md 3.5) - 3:00 max, leads with the replay result

Not recorded yet. Exact commands/clicks below so recording it is mechanical.

## 0:00-0:35 - Lead with the strongest, most verifiable claim

Screen: terminal.
```
forge replay
```
Say: "This prints the committed replay of our optimizer against FabX's real, public task bank on X
Layer (the live re-run script is packages/core/scripts/fabx-replay-v2.ts) - not a demo
bank, the actual 100 tasks miners compete on. Of the 46 tasks that have a complete, honest
specification - the other 54 are sampled-only, and we exclude them rather than overfit - we
beat the reference on 22, tie on 11, lose on 13. Zero of those numbers are guessed."

## 0:35-1:05 - The independent re-verification (why you should believe the 22)

Screen: terminal.
```
python3 packages/core/scripts/verify_independent.py
```
Say: "Every one of those 22 beats is re-checked by a second, completely separate tool - pure
Python standard library, zero network calls, its own from-scratch NAND simulator that shares no
code with the TypeScript engine that produced the result. 22 tasks, almost 26,000 individual
output-bit comparisons, zero mismatches. That's the real safety property this project sells:
not that it's fast, that it's checkable."

## 1:05-1:50 - The live web app

Screen: browser, apps/web (built: `pnpm --filter @forgeout/web build`, served locally).
- Click into the "Verified improvements" gallery. Scroll to task 12 (the biggest beat, 4x cap).
  Point at: Cref, our C, q=4.000x, the real netlist hex, the real tape-out calldata, and the
  copy button on each.
- Scroll up to the live optimizer. Paste `(a&b)|(a&c)|(b&c)` (3-input majority) into the
  expression box, objective=area, click Optimize. Point at: before/after gate counts, the
  "verified: true (method=...)" line, the downloadable netlist hex. Say: "This whole thing runs
  in your browser - nothing is sent anywhere. No ABC in this build, by design; the CLI is where
  that runs."
- Scroll to the registry section. Point at the registry address, the five showcase circuits and the four additional test registrations. Say: "This is live on X Layer. Four are verified on-chain through the processor's own eval; GC-046 has 8 inputs, so it is attestation-only and the page says so."

## 1:50-2:25 - Real on-chain reads (not a mock)

Screen: terminal.
```
forge verify-onchain --processor 0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6 --id 65 --inputs 0x07
```
Say: "This is a real, live eth_call against X Layer right now - circuit 65 on the real
FabX processor (FAB_TST), which happens to already sit at the proven 6-gate minimum for 3-input
majority. Local simulation against the actual deployed contract, matching exactly."

## 2:25-2:50 - The dry-run tape-out path (honest about what's NOT done)

Screen: terminal.
```
forge calldata netlist.hex --nin 4 --nout 1
```
Say: "This builds the real tapeout() calldata against the real fee schedule on X Layer - real
ABI, real fees, verified live on a fork. It never sends anything. Five showcase circuits (GC-012, GC-037, GC-050, GC-014, GC-046) are already tapped out and registered by the
owner with their own key - docs/TAPEOUTS.md has every transaction. The other 13 gallery circuits are
not tapped out. We'd rather say that than overstate it."

Optional, if time remains: "We went one step further for one circuit - `forge export-silicon`
generated a real Tiny Tapeout repo, and we ran Tiny Tapeout's own CI on it for real. Synthesis
and DRC both passed, 15 out of 15 checks, producing a real 34-cell GDS. Tapeout-ready export.
We have not ordered fabrication. Ordering is a separate paid step that the circuit owner
completes on Tiny Tapeout. We do not claim a physical chip exists." (docs/SILICON.md, run
39150702389 on github.com/davieslennox0/maj3-silicon-spike)

## 2:50-3:00 - Close

Say: "Forgeout: infrastructure, not an app. The headline number is real, independently
re-checked, and the honest gaps - no proven synthesis above 3 inputs, FabX's reward formula still
has undefined terms - are documented, not hidden. Repo: github.com/davieslennox0/tapeout-forge (private until the owner changes its visibility)."
