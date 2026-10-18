# 2.1: independent re-verification of all 22 beats

Tooling used is genuinely independent of the TS codebase: scripts/dump_beats.ts dumps each
beat's raw NAND gate list (output of optimize(), no serialize/parse round-trip); a from-scratch
Python script (scripts/verify_beats.py) re-fetches each task's real vectors from api.fabx.tech
directly (separate HTTP call, not reading any cached file our TS uses), simulates the dumped
gates with its own NAND interpreter, and independently recomputes gates/depth/C with its own
formula - none of equivalence.ts, simulate.ts or cost.ts is imported.

**Result: 0/22 truth-table mismatches, 0/22 cost mismatches.** Every independently-recomputed C
matches docs/FABX-REPLAY.md's reported bestC exactly (task 7: 875, 12: 28672, 13: 29000, 14: 4116,
16: 26000, 21: 12348, 22: 10290, 23: 18432, 35: 371293, 36: 81000, 37: 26244, 39: 205632,
40: 222912, 43: 889253, 44: 113135, 45: 93000, 46: 92000, 47: 26068, 50: 15778, 53: 49392,
54: 53217, 55: 64152). No bug found; the Phase 1c/1c.5 replay numbers stand confirmed by a
second, independent tool.
