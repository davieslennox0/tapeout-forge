# 1c.1: task bank spec completeness (VERIFIED, api.fabx.tech)

Endpoint: GET /v1/pod/tasks/{id}/vectors?chainId=196 -> Merkle-committed vector set (root, leafEncoding, 256 (input,expectedOut,proof) entries). Fetched live for all 100 tasks.

Rule: a task's 256-vector sample is a COMPLETE deterministic spec only if kind=comb AND nIn<=8 (256 >= 2^nIn, so the full input space fits and can be checked for consistency). Verified programmatically: for each such task, the 256 samples cover all 2^nIn low-bit residues with zero inconsistent (input&mask -> output) mappings.

- COMPLETE (replayable): 46 tasks, ids: 1-25, 34-40, 43-51, 53-55, 87, 88
- SAMPLED ONLY (skip, not a valid spec to fit): 54 tasks
  - comb, nIn>8 (8 tasks): 26, 31, 32, 33, 41, 42, 52, 81 -- 256 random samples out of 2^nIn (up to 2^18), not exhaustive
  - seq, all 46 sequential tasks: 27-30, 56-100 minus 87,88 -- state space 2^(nIn*cycles) >> 256, samples are random input/state sequences, not a function definition

Do not fit sampled vectors (overfitting). Phase 1c/1.5 replay is restricted to the 46 COMPLETE tasks.
