# Nandout case study: can forge shrink an existing project's circuits?

**Status of this document:** read-only analysis, written 2026-10-26. No transaction was sent, no key was used, and nothing Nandout owns was modified or re-taped-out.

**Required wording.** Nandout (github.com/davieslennox0/nandout, public, created 2026-10-11, which predates this event) is an existing project. It is used here **only as test input**. Nothing in this document claims Nandout's circuits, contracts or design as work done for this event. The only post-2026-10-16 work claimed here is the analysis and the tooling used to run it (see `docs/REUSED.md`).

## Result in one paragraph

Of Nandout's 11 taped-out circuits, 10 are combinational and were analysed; the 11th (#6) contains a LATCH and was **not** analysed (the optimizer and the equivalence checker are combinational-only). **forge found no gate saving on any of the 10.** Total gates saved: **0 of 55**. On three circuits (#3, #5, #11) it found an equivalent netlist with lower logic depth (10 to 6, 6 to 4, 6 to 5). Depth does not enter the mint-fee or eval-gas model (both are per gate), so the estimated OKB and gas saving is **0** for every circuit. Nandout's circuits were already tight: for the six circuits that use at most 3 of their 16 inputs, the gate counts equal the exact-synthesis minimum.

## 1. Nandout's deployed circuits (on-chain, read-only)

Processor: `0x8A60B4A4BCf4066F5E5F9A406fE09c5e4f52a58E`, `name()` = "Nandout", X Layer (chain 196). Read on 2026-10-26 with `eth_call` against `https://rpc.xlayer.tech`: `circuitInfo(uint256)` and `netlist(uint256)` for ids 0 to 13. Ids 1 to 11 exist and return data; ids 0, 12 and 13 revert. Every one of the 11 netlists is **readable on-chain** (`netlist(id)` returns the TAP-02 bytes). Gate counts below are the on-chain `circuitInfo` values and match the byte lengths of the netlists (NAND = 7 bytes, LATCH = 4 bytes).

| id | name (see note) | inputs | outputs | gates (on-chain) | latches | inputs the function actually depends on |
|---|---|---|---|---|---|---|
| 1 | BASIC_SAFETY | 16 | 1 | 4 | 0 | 3 |
| 2 | REVENUE_AGENTS | 16 | 1 | 4 | 0 | 3 |
| 3 | STRICT | 16 | 1 | 13 | 0 | 7 |
| 4 | UNLOCK_T1 | 16 | 1 | 4 | 0 | 3 |
| 5 | UNLOCK_T2 | 16 | 1 | 6 | 0 | 4 |
| 6 | STICKY_SAFETY | 16 | 1 | 11 (10 NAND + 1 LATCH) | 1 | not analysed |
| 7 | VOL_GUARD | 16 | 1 | 6 | 0 | 4 |
| 8 | DEPTH_GUARD | 16 | 1 | 6 | 0 | 3 |
| 9 | ROUTE_SPLIT | 16 | 1 | 1 | 0 | 1 |
| 10 | ROUTE_GUARD | 16 | 1 | 3 | 0 | 2 |
| 11 | MARKET_SAFE | 16 | 1 | 8 | 0 | 4 |

All on processor 230 (`0x8A60…a58E`). Total: 66 gates (55 combinational + 11 in #6).

**Note on names (partly UNVERIFIED).** The chain stores no circuit names. Names for #7 to #11 are taken from Nandout's own README and `docs/SUBMISSION.md`. Names for #1 to #6 follow the order in which Nandout's `docs/SUBMISSION.md` lists its six starter circuits; #6 being the only circuit with a LATCH is consistent with STICKY_SAFETY, but the id-to-name mapping for #1 to #5 is an inference from list order, not a chain read. The analysis itself does not depend on the names.

## 2. Method

1. Read each netlist from chain (`cast call <processor> "netlist(uint256)(bytes)" <id>`), parse it with `packages/core`'s TAP-02 parser (16 inputs, 1 output), and compute its full 2^16 truth table.
2. Run the same `optimize()` function that `forge optimize` calls (called directly from a script, not through the CLI binary) with each objective: `area`, `depth`, `balanced` and `c`, plus the structural-dedup pass on the original netlist. `yosys-abc` was on the PATH, so optimize()'s ABC candidates were included. Each call took roughly 5 to 15 seconds.
3. For the six circuits that depend on 3 or fewer inputs (#1, #2, #4, #8, #9, #10), project the function onto its real inputs and run the exact-synthesis library (exact synthesis is limited to 3 inputs), then map the result back onto the 16-input signal space.
4. **Equivalence, two independent checks, both exhaustive over all 65,536 input rows:** (a) `checkEquivalence` from `packages/core` (exhaustive up to 20 inputs); (b) the stand-alone Python script in the appendix (stdlib only, no network, own parser and own NAND interpreter, shares no code with `packages/core`). Result: **56 of 56 candidate netlists match the on-chain original** (10 circuits x 5 optimizer candidates, plus 6 exact-reduced candidates). Zero mismatches.
5. Cost estimate from `config/cost.ts` conventions: mint cost = 1 transistor per NAND gate; eval gas = `gasFixed + gasPerGate x (gates + 2)`.

Nandout's fees, read from chain on 2026-10-26: `TAPEOUT_FEE()` = 0.0013 OKB; transistor contract `0xa5eCCEd599470f97781E3Bc10D7a380F96996aF6` with `mintPrice()` = 0.001 OKB per transistor and `protocolFee()` = 0.00066 OKB; `supplyCap()` = 500,000, `minted()` = 78.

## 3. Results

"After" is the best result across all candidates for that circuit (fewest gates, then lowest depth). No candidate had fewer gates than the original on any circuit.

| id | name | gates before | gates after | gates saved | depth before | depth after | mint saved (OKB) | eval gas saved |
|---|---|---|---|---|---|---|---|---|
| 1 | BASIC_SAFETY | 4 | 4 | 0 | 4 | 4 | 0 | 0 |
| 2 | REVENUE_AGENTS | 4 | 4 | 0 | 4 | 4 | 0 | 0 |
| 3 | STRICT | 13 | 13 | 0 | 10 | **6** | 0 | 0 |
| 4 | UNLOCK_T1 | 4 | 4 | 0 | 4 | 4 | 0 | 0 |
| 5 | UNLOCK_T2 | 6 | 6 | 0 | 6 | **4** | 0 | 0 |
| 6 | STICKY_SAFETY | 11 | not analysed | n/a | n/a | n/a | n/a | n/a |
| 7 | VOL_GUARD | 6 | 6 | 0 | 4 | 4 | 0 | 0 |
| 8 | DEPTH_GUARD | 6 | 6 | 0 | 4 | 4 | 0 | 0 |
| 9 | ROUTE_SPLIT | 1 | 1 | 0 | 1 | 1 | 0 | 0 |
| 10 | ROUTE_GUARD | 3 | 3 | 0 | 2 | 2 | 0 | 0 |
| 11 | MARKET_SAFE | 8 | 8 | 0 | 6 | **5** | 0 | 0 |
| | **Total (10 analysed)** | **55** | **55** | **0** | | | **0** | **0** |

- **Gates:** 0 saved in total.
- **Best case:** a lower-depth netlist for #3 STRICT (depth 10 to 6) with the same 13 gates. For a FabX-style cost `C = gates x depth^3` (unbuffered, informational only; Nandout does not use FabX scoring) that is 13,000 to 2,808. #5 would go 1,296 to 384 and #11 1,728 to 1,000.
- **Worst case:** no change at all (7 of the 10 analysed circuits: same gates, same depth). The best candidate was never worse than the original, although some individual candidates were: the exact-synthesis results for #8 and #10 had more depth (5 vs 4, 3 vs 2) at the same gate count, and were not selected.
- **Why depth does not translate into savings here:** the mint fee is per gate and eval gas in the cost model is per gate; neither has a depth term. So the depth improvements have no OKB or gas value in this model.
- **Estimated value of the 0-gate result:** at 0.001 OKB per gate, the 55 analysed gates cost 0.055 OKB to mint, and the whole 66-gate set 0.066 OKB, plus 0.0013 + 0.00066 OKB per circuit in fees. A saving would have been worth 0.001 OKB per gate; the finding is that there is none to claim.
- **Immutable anyway:** Nandout's circuits are immutable once registered. Even a real saving could only apply to new circuits; this study re-deploys nothing.

## 4. Limits

- **"No improvement found" is not "optimal".** The optimizer re-synthesises from the truth table (Shannon decomposition over two variable orderings, plus optional ABC); it does not rewrite the existing netlist's structure. Exact synthesis only covers 3 inputs, so minimality is established only for the six circuits that use 3 or fewer inputs (#1, #2, #4, #8, #9, #10, where the on-chain count equals the exact-library result). For #3, #5, #7 and #11 (4 to 7 real inputs) a smaller netlist might exist that this method did not find. This is the known n>3 exact-synthesis gap listed in `docs/SUBMISSION.md`.
- **#6 (LATCH) not analysed.** Sequential circuits are outside the optimizer and the equivalence checker.
- **Gas figures are an estimate.** `gasFixed`/`gasPerGate` in `config/cost.ts` were measured on OrderGuard; Nandout measured different values (about 51,000 fixed and 2,300 per gate, see `docs/REUSED.md` open item 2). With a 0-gate saving the choice of constants does not change the conclusion.
- **Names for #1 to #5 are inferred** (section 1 note).
- **Snapshot:** chain state read on 2026-10-26; later changes are not reflected.

## 5. Reproduce

```
cast call 0x8A60B4A4BCf4066F5E5F9A406fE09c5e4f52a58E "netlist(uint256)(bytes)" <id 1..11> --rpc-url https://rpc.xlayer.tech
python3 -I verify_nandout.py analysis.json     # script below; analysis.json = the original and candidate netlist hex per circuit
```

### Appendix A: on-chain netlists read on 2026-10-26 (TAP-02 hex)

```
 1 BASIC_SAFETY    0x00000005000006000000120000120000000800001300000014000014
 2 REVENUE_AGENTS  0x00000002000003000000120000120000000500001300000014000014
 3 STRICT          0x000000090000090000000b00000b000000120000130000000200000300000015000015000000050000160000001700001700000007000018000000190000190000000800001a0000001b00001b0000001400001c0000001d00001d
 4 UNLOCK_T1       0x0000000500000a000000120000120000000c00001300000014000014
 5 UNLOCK_T2       0x0000000400000b000000120000120000000d000013000000140000140000000500001500000016000016
 6 STICKY_SAFETY   0x0100001c0000000e00000e0000000800001300000006000008000000150000150000000c0000160000001200001200000017000018000000140000140000001900001a0000001b00001b
 7 VOL_GUARD       0x000000040000040000000600000600000012000013000000030000140000000200000200000015000016
 8 DEPTH_GUARD     0x000000040000040000000500000500000012000013000000140000140000000600000600000015000016
 9 ROUTE_SPLIT     0x00000002000002
10 ROUTE_GUARD     0x000000030000030000000400000400000012000013
11 MARKET_SAFE     0x000000050000050000000c00000c0000001200001300000008000014000000150000150000000e00000e0000001600001700000018000018
```

### Appendix B: independent equivalence checker (Python stdlib only)

```python
#!/usr/bin/env python3
"""Independent check: every candidate netlist equals the on-chain original on all 2^16 rows.
Python stdlib only, no network, shares no code with packages/core. NAND-only (TAP-02 opcode 0x00)."""
import json, sys

def parse(h):
    d = bytes.fromhex(h[2:] if h.startswith("0x") else h)
    g, i = [], 0
    while i < len(d):
        if d[i] != 0x00:
            raise ValueError("non-NAND opcode %02x" % d[i])
        g.append((int.from_bytes(d[i+1:i+4], "big"), int.from_bytes(d[i+4:i+7], "big")))
        i += 7
    return g

def table(g, nin=16):
    out = []
    for x in range(1 << nin):
        s = [0, 1] + [(x >> k) & 1 for k in range(nin)] + [0] * len(g)
        b = 2 + nin
        for k, (a, c) in enumerate(g):
            s[b + k] = 1 - (s[a] & s[c])
        out.append(s[-1])          # single output = last gate (TAP-02 convention)
    return out

bad = 0
for r in json.load(open(sys.argv[1])):
    if "skipped" in r:
        print("id %2d %-15s SKIPPED (%s)" % (r["id"], r["name"], r["skipped"])); continue
    ref = table(parse(r["hex"]))
    for k, c in r["cands"].items():
        ok = table(parse(c["hex"])) == ref
        bad += 0 if ok else 1
        print("id %2d %-15s %-9s gates=%-2d %s" % (r["id"], r["name"], k, c["gates"], "MATCH 65536/65536" if ok else "MISMATCH"))
print("SUMMARY:", "FAIL" if bad else "PASS", "mismatches=%d" % bad)
sys.exit(1 if bad else 0)
```
