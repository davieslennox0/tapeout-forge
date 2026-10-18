# Benchmarks (BUILD.md section 6)

Gates/depth shown WITHOUT the 2*nOut contract buffers (user circuit only); C is computed WITH buffers (the convention resolved in docs/FABX-REPLAY.md). Every result below is verified exhaustively equivalent to its spec before being reported - optimize() producing a wrong circuit would throw, not silently report a number.

| benchmark | objective | gates | depth | C (buffered) |
|---|---|---|---|---|
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | area | 177 | 19 | 1731807 |
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | depth | 210 | 17 | 1508980 |
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | balanced | 178 | 19 | 1741068 |
| 4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout) | c | 210 | 17 | 1508980 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | area | 71 | 8 | 77000 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | depth | 71 | 8 | 77000 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | balanced | 71 | 8 | 77000 |
| 4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt) | c | 71 | 8 | 77000 |
| 2:1 mux (i0, i1, sel -> out) | area | 4 | 3 | 750 |
| 2:1 mux (i0, i1, sel -> out) | depth | 4 | 3 | 750 |
| 2:1 mux (i0, i1, sel -> out) | balanced | 4 | 3 | 750 |
| 2:1 mux (i0, i1, sel -> out) | c | 4 | 3 | 750 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | area | 11 | 5 | 4459 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | depth | 11 | 5 | 4459 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | balanced | 11 | 5 | 4459 |
| 4:1 mux (i0..i3, sel0, sel1 -> out) | c | 11 | 5 | 4459 |
| 8-bit parity (in[0..7] -> out) | area | 36 | 13 | 128250 |
| 8-bit parity (in[0..7] -> out) | depth | 36 | 13 | 128250 |
| 8-bit parity (in[0..7] -> out) | balanced | 36 | 13 | 128250 |
| 8-bit parity (in[0..7] -> out) | c | 36 | 13 | 128250 |

## Does depth ever beat area on C?

- **4-bit adder (a[0..3], b[0..3], cin -> sum[0..3], cout)**: area-objective C=1731807, depth-objective C=1508980 - depth WINS on C.
- **4-bit comparator (x[0..3], y[0..3] -> gt, eq, lt)**: area-objective C=77000, depth-objective C=77000 - area wins or ties on C.
- **2:1 mux (i0, i1, sel -> out)**: area-objective C=750, depth-objective C=750 - area wins or ties on C.
- **4:1 mux (i0..i3, sel0, sel1 -> out)**: area-objective C=4459, depth-objective C=4459 - area wins or ties on C.
- **8-bit parity (in[0..7] -> out)**: area-objective C=128250, depth-objective C=128250 - area wins or ties on C.

**Yes**, for at least one benchmark above, minimizing depth produces a lower overall C than minimizing gate count - because C's depth term is cubed, a circuit with more gates but meaningfully less depth can still win.
