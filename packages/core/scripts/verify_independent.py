#!/usr/bin/env python3
"""3.0b (BUILD.md): fully self-contained independent re-verification of all 22 real FabX beats.

Reads ONLY the committed snapshot at scripts/tasks.json (real vectors + our already-built,
already-serialized netlist hex, captured once from api.fabx.tech - see that file's own
_sourceUrl/_capturedDate fields). Python stdlib only (json, sys - no urllib, no network calls
of any kind). Independently parses the TAP-02 netlist bytes and simulates them with its own
from-scratch NAND interpreter - shares no code with packages/core's TypeScript netlist.ts or
simulate.ts. This removes the earlier verify_beats.py's dependency on a /tmp intermediate file
that a codespace stop/resume cycle once destroyed (docs/NEW.md).

Run: python3 packages/core/scripts/verify_independent.py
Exit code: 0 if every task matches on every input row for every output bit; 1 on any mismatch.
"""
import json
import sys


def parse_netlist(hex_str, nIn, nOut):
    """TAP-02 bytes (BUILD.md section 3): NAND = 0x00 | u24 a | u24 b, big-endian. No LATCH/REF
    in these 22 tasks (all combinational, nIn<=8 per docs/VECTOR-SPEC-CHECK.md's gating)."""
    data = bytes.fromhex(hex_str[2:] if hex_str.startswith("0x") else hex_str)
    gates = []
    i = 0
    while i < len(data):
        op = data[i]
        if op != 0x00:
            raise ValueError(f"unexpected opcode 0x{op:02x} at byte {i} (expected NAND=0x00)")
        a = int.from_bytes(data[i + 1 : i + 4], "big")
        b = int.from_bytes(data[i + 4 : i + 7], "big")
        gates.append((a, b))
        i += 7
    return gates


def simulate(gates, nIn, inp_bits):
    """signal 0=const0, 1=const1, 2..1+nIn=inputs, then one signal per gate in order."""
    sig = [0, 1] + list(inp_bits) + [0] * len(gates)
    base = 2 + nIn
    for gi, (a, b) in enumerate(gates):
        sig[base + gi] = 1 - (sig[a] & sig[b])
    return sig


def main():
    with open("packages/core/scripts/tasks.json") as f:
        snap = json.load(f)

    total_mismatches = 0
    rows_checked = 0

    for task in snap["tasks"]:
        tid, nIn, nOut, Cref = task["id"], task["nIn"], task["nOut"], task["Cref"]
        gates = parse_netlist(task["netlistHex"], nIn, nOut)
        mask = (1 << nIn) - 1
        mismatches = 0

        for v in task["vectors"]:
            inp = int(v["input"], 16) & mask
            want_out = int(v["expectedOut"], 16)
            inp_bits = [(inp >> i) & 1 for i in range(nIn)]
            sig = simulate(gates, nIn, inp_bits)
            # Last nOut signals are the outputs, in order (BUILD.md section 3).
            out_bits = sig[len(sig) - nOut :]
            for k in range(nOut):
                want_bit = (want_out >> k) & 1
                rows_checked += 1
                if out_bits[k] != want_bit:
                    mismatches += 1
                    total_mismatches += 1

        status = "OK" if mismatches == 0 else f"MISMATCH x{mismatches}"
        print(f"task {tid:>3} ({task['name']}): nIn={nIn} nOut={nOut} gates={len(gates)} Cref={Cref} {status}")

    print()
    print(f"{len(snap['tasks'])} tasks, {rows_checked} output-bit comparisons, {total_mismatches} mismatches.")
    sys.exit(1 if total_mismatches else 0)


if __name__ == "__main__":
    main()
