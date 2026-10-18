# Benchmarks (BUILD.md section 6)

Gates/depth shown WITHOUT the 2*nOut contract buffers (user circuit only); C is computed WITH buffers (the convention resolved in docs/FABX-REPLAY.md). Every result below is verified exhaustively equivalent to its spec before being reported - optimize() producing a wrong circuit would throw, not silently report a number.

| benchmark | objective | gates | depth | C (buffered) |
|---|---|---|---|---|
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | area | 429 | 18 | 3512000 |
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | depth | 459 | 17 | 3216871 |
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | balanced | 429 | 18 | 3512000 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | area | 316 | 15 | 1581986 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | depth | 316 | 15 | 1581986 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | balanced | 316 | 15 | 1581986 |
| 2:1 mux (i0, i1, sel -> out) | area | 4 | 3 | 750 |
| 2:1 mux (i0, i1, sel -> out) | depth | 4 | 3 | 750 |
| 2:1 mux (i0, i1, sel -> out) | balanced | 4 | 3 | 750 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | area | 25 | 8 | 27000 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | depth | 25 | 8 | 27000 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | balanced | 25 | 8 | 27000 |
| 8-bit parity (in[0..7] -> out) | area | 44 | 16 | 268272 |
| 8-bit parity (in[0..7] -> out) | depth | 44 | 16 | 268272 |
| 8-bit parity (in[0..7] -> out) | balanced | 44 | 16 | 268272 |

## Does depth ever beat area on C?

- **4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout)**: area-objective C=3512000, depth-objective C=3216871 - depth WINS on C.
- **4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt)**: area-objective C=1581986, depth-objective C=1581986 - area wins or ties on C.
- **2:1 mux (i0, i1, sel -> out)**: area-objective C=750, depth-objective C=750 - area wins or ties on C.
- **4:1 mux (i0..i3, sel0, sel1 -> out)**: area-objective C=27000, depth-objective C=27000 - area wins or ties on C.
- **8-bit parity (in[0..7] -> out)**: area-objective C=268272, depth-objective C=268272 - area wins or ties on C.

**Yes**, for at least one benchmark above, minimizing depth produces a lower overall C than minimizing gate count - because C's depth term is cubed, a circuit with more gates but meaningfully less depth can still win.
