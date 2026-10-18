# 2.0: beat/loss distribution analysis (from docs/FABX-REPLAY.md's 46-task replay)

## Beats (22/46)
q distribution: min=1.075, median=1.926, max=4.000 (only task 12 hits the 4x cap).
Only 4/22 beats are small-margin (q<1.3): tasks 15(no,wait see losses),7,13,40 roughly - see full table.
By difficulty tier: simple=8, medium=14, hard=0 (no hard-task beats at all).
By nIn: nIn4=8, nIn8=8, nIn7=3, nIn2=1, nIn5=1, nIn6=1.
Honest read: the median beat (~1.93x) is a real, non-trivial improvement - the 22 beats headline is not just marginal wins, but it also is not uniform: 4/22 beats are under 1.3x margin.

## Losses (13/46), sorted worst to least-bad
| id | nIn | tier | Cref | ourC | q |
|---|---|---|---|---|---|
| 24 | 4 | simple | 128 | 2048 | 0.250 (clamped; true ratio 0.0625) |
| 25 | 4 | simple | 64 | 1024 | 0.250 (clamped; true ratio 0.0625) |
| 87 | 7 | hard | 823080 | 1967448 | 0.418 |
| 38 | 8 | medium | 404681 | 839680 | 0.482 |
| 34 | 8 | medium | 139944 | 226368 | 0.618 |
| 49 | 4 | medium | 14336 | 22016 | 0.651 |
| 18 | 3 | simple | 6656 | 9216 | 0.722 |
| 48 | 4 | medium | 2500 | 2875 | 0.870 |
| 17 | 2 | simple | 1125 | 1250 | 0.900 |
| 88 | 8 | hard | 3863552 | 4257360 | 0.907 |
| 11 | 3 | simple | 8918 | 9604 | 0.929 |
| 51 | 8 | medium | 713336 | 759375 | 0.939 |
| 15 | 4 | simple | 7168 | 7203 | 0.995 |

Structural finding on the two worst losses (24, 25): both are pure bit-permutation tasks (fixed shift / bit-reverse) where the on-chain reference likely achieves near-zero cost by wiring an output directly to an input bit with no gate at all. Our netlist model (packages/core) cannot represent a bare-wire output - every output must pass through >=1 real NAND - so these two losses are a representational limitation, not a weak optimizer. Both hit the q=1/4 floor; true C ratio is 0.0625, worse than the clamp shows.

## Honest summary
8/13 losses are easy or medium tier functions where a human-written reference is apparently already efficient or (for 24/25) structurally unbeatable under our model. 2/13 losses are hard tier (87, 88) where our Shannon+ABC approach falls short on genuinely larger functions - consistent with the n=4+ exact-synthesis gap already flagged as the #1 risk in Phase 1c.
