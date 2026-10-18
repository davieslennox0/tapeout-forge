# Benchmarks (BUILD.md section 6)

Gates/depth shown WITHOUT the 2*nOut contract buffers (user circuit only); C is computed WITH buffers (the convention resolved in docs/FABX-REPLAY.md). Every result below is verified exhaustively equivalent to its spec before being reported - optimize() producing a wrong circuit would throw, not silently report a number.

| benchmark | objective | gates | depth | C (buffered) |
|---|---|---|---|---|
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | area | 422 | 17 | 2963088 |
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | depth | 422 | 17 | 2963088 |
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | balanced | 422 | 17 | 2963088 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | area | 309 | 15 | 1547595 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | depth | 314 | 15 | 1572160 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | balanced | 309 | 15 | 1547595 |
| 2:1 mux (i0, i1, sel -> out) | area | 4 | 3 | 750 |
| 2:1 mux (i0, i1, sel -> out) | depth | 4 | 3 | 750 |
| 2:1 mux (i0, i1, sel -> out) | balanced | 4 | 3 | 750 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | area | 25 | 8 | 27000 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | depth | 25 | 8 | 27000 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | balanced | 25 | 8 | 27000 |
| 8-bit parity (in[0..7] -> out) | area | 53 | 15 | 270215 |
| 8-bit parity (in[0..7] -> out) | depth | 53 | 15 | 270215 |
| 8-bit parity (in[0..7] -> out) | balanced | 53 | 15 | 270215 |

## Does depth ever beat area on C?

- **4-bit adder**: area-objective C=2963088, depth-objective C=2963088 - area wins or ties on C.
- **4-bit comparator**: area-objective C=1547595, depth-objective C=1572160 - area wins or ties on C.
- **2:1 mux**: area-objective C=750, depth-objective C=750 - area wins or ties on C.
- **4:1 mux**: area-objective C=27000, depth-objective C=27000 - area wins or ties on C.
- **8-bit parity**: area-objective C=270215, depth-objective C=270215 - area wins or ties on C.

**No**, for none of these benchmarks does the depth-objective candidate achieve a lower C than the area-objective candidate. This implementation's "area" and "depth" objectives currently select from the SAME small 2-order candidate set (see optimize.ts's documented 2-order Pareto front), so "area" already tends to pick the lower-depth option too whenever it also happens to need fewer gates. A genuinely depth-vs-area tradeoff (where depth sacrifices gates for a shallower critical path, winning on C's cubed depth term) would need a richer candidate search than this session built - a real limitation, reported honestly rather than claimed as a feature that works.
