#!/usr/bin/env python3
"""BUILD.md 1c.2: run our own best netlist through yosys-abc (NAND2+INV-only
genlib, several resynthesis flows) and emit each surviving mapped candidate
as a NAND-only netlist JSON. Caller (optimize.ts) MUST re-verify equivalence
against the original truth table before trusting any candidate - this script
only maps and parses, it does not verify.

Usage: python3 abc_map.py <in_netlist.json> <out_candidates.json>
in_netlist.json: {"nIn": int, "gates": [{"a": int, "b": int}, ...]} (NAND-only,
  our signal convention: 0=const0, 1=const1, 2..1+nIn=inputs, then one signal
  per gate in order; last gate is the single output).
"""
import json, re, subprocess, sys, os, tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENLIB = os.path.join(SCRIPT_DIR, "nand.genlib")

FLOWS = {
    "area": "strash; balance; rewrite; refactor; balance; rewrite; rewrite -z; balance; refactor -z; rewrite -z; balance",
    "dch": "strash; balance; dch",
    "dch_delay": "strash; balance; dch",  # mapped with a tight delay target below
}


def netlist_to_blif(nl, path):
    nIn = nl["nIn"]
    gates = nl["gates"]
    sig_name = {0: "czero", 1: "cone"}
    for i in range(nIn):
        sig_name[2 + i] = f"pi{i}"
    out_sig = 2 + nIn + len(gates) - 1
    lines = [".model top", f".inputs {' '.join(sig_name[2+i] for i in range(nIn))}"]
    lines.append(f".outputs {sig_name.get(out_sig, f'g{len(gates)-1}')}")
    lines.append(".names czero\n")  # empty cover = always 0
    lines.append(".names cone\n1\n")
    for i, g in enumerate(gates):
        mysig = 2 + nIn + i
        myname = sig_name.setdefault(mysig, f"g{i}")
        a, b = sig_name[g["a"]], sig_name[g["b"]]
        lines.append(f".names {a} {b} {myname}\n0- 1\n-0 1\n")
    lines.append(".end\n")
    with open(path, "w") as f:
        f.write("\n".join(lines))


def run_abc(in_blif, resyn_script, out_blif, delay_target=None):
    map_cmd = f"map -D {delay_target}" if delay_target else "map"
    script = (
        f"read_blif {in_blif}; {resyn_script}; "
        f"read_genlib {GENLIB}; {map_cmd}; write_blif {out_blif}"
    )
    r = subprocess.run(["yosys-abc", "-c", script], capture_output=True, text=True, timeout=60)
    return r.returncode == 0 and os.path.exists(out_blif) and os.path.getsize(out_blif) > 0


GATE_RE = re.compile(r"^\.gate\s+(\S+)\s+(.*)$")


def parse_mapped_blif(path, nIn):
    with open(path) as f:
        text = f.read()
    inputs_line = re.search(r"^\.inputs\s+(.*)$", text, re.M)
    outputs_line = re.search(r"^\.outputs\s+(.*)$", text, re.M)
    if not inputs_line or not outputs_line:
        return None
    pi_names = inputs_line.group(1).split()
    out_name = outputs_line.group(1).split()[0]

    # net -> (cell, {pin: net}) for every .gate line; const nets handled specially.
    gate_lines = [m for m in (GATE_RE.match(l) for l in text.splitlines()) if m]
    net_def = {}  # output net -> (cell, pin->net dict)
    for m in gate_lines:
        cell, rest = m.group(1), m.group(2)
        pins = dict(tok.split("=", 1) for tok in rest.split())
        onet = pins.get("O")
        if onet is None:
            continue
        net_def[onet] = (cell, pins)

    base_sig = {}
    base_sig["czero"] = 0
    base_sig["cone"] = 1
    for i, nm in enumerate(pi_names):
        base_sig[nm] = 2 + i

    memo = {}  # net name -> our signal number (materialized gate order)
    gates = []

    def materialize(net):
        if net in base_sig:
            return base_sig[net]
        if net in memo:
            return memo[net]
        if net not in net_def:
            raise ValueError(f"unmapped net {net} (not a const/PI/gate output)")
        cell, pins = net_def[net]
        if cell == "INV":
            a = materialize(pins["a"])
            sig = 2 + nIn + len(gates)
            gates.append({"a": a, "b": a})
        elif cell == "NAND2":
            a = materialize(pins["a"])
            b = materialize(pins["b"])
            sig = 2 + nIn + len(gates)
            gates.append({"a": a, "b": b})
        elif cell == "ZERO":
            memo[net] = 0
            return 0
        elif cell == "ONE":
            memo[net] = 1
            return 1
        else:
            raise ValueError(f"unexpected cell {cell} (genlib only has NAND2/INV/ZERO/ONE)")
        memo[net] = sig
        return sig

    out_sig = materialize(out_name)
    if gates and out_sig != 2 + nIn + len(gates) - 1:
        # output isn't the last materialized gate (e.g. output is a bare
        # PI/const, or an earlier shared gate) - append a double-negation
        # buffer so our "output = last gate" convention still holds.
        a = out_sig
        n1 = 2 + nIn + len(gates)
        gates.append({"a": a, "b": a})
        gates.append({"a": n1, "b": n1})
    elif not gates:
        # whole function is a bare wire (const or PI) - 2-gate buffer, per
        # optimize.ts's own literalNetlistIfTrivial convention.
        a = out_sig
        gates.append({"a": a, "b": a})
        gates.append({"a": 2 + nIn, "b": 2 + nIn})
        gates[-1] = {"a": 2 + nIn + 0, "b": 2 + nIn + 0}

    return {"nIn": nIn, "gates": gates}


def main():
    in_path, out_path = sys.argv[1], sys.argv[2]
    with open(in_path) as f:
        nl = json.load(f)

    with tempfile.TemporaryDirectory() as td:
        in_blif = os.path.join(td, "in.blif")
        netlist_to_blif(nl, in_blif)

        candidates = []
        attempts = [
            ("area", FLOWS["area"], None),
            ("dch", FLOWS["dch"], None),
            ("dch_delay1", FLOWS["dch_delay"], 1),
        ]
        for name, resyn, delay in attempts:
            out_blif = os.path.join(td, f"out_{name}.blif")
            try:
                if run_abc(in_blif, resyn, out_blif, delay):
                    cand = parse_mapped_blif(out_blif, nl["nIn"])
                    if cand is not None:
                        candidates.append({"flow": name, "netlist": cand})
            except Exception as e:
                sys.stderr.write(f"abc_map: flow {name} failed: {e}\n")

    with open(out_path, "w") as f:
        json.dump(candidates, f)
    sys.stderr.write(f"abc_map: {len(candidates)} candidate(s) produced\n")


if __name__ == "__main__":
    main()
