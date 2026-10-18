#!/usr/bin/env python3
"""SAT-based exact minimum-GATE-COUNT NAND synthesis (BUILD.md step 1b.2).

CORRECTNESS NOTE (found during development, do not regress): solving only
an NPN-canonical REPRESENTATIVE and then bolting inverter gates onto its
circuit to realize other class members does NOT give a true minimum for
those other members - input/output negation costs a real NAND gate in this
technology (unlike idealized AIG representations where edge inversion is
free), so a class's "easiest" member can need strictly fewer gates than
another member whose minimal circuit the representative's construction
doesn't reach. Caught concretely: MAJ3 (tt=232, n=3) has a true minimum of
6 gates (verified by direct solve + manual simulation), but solving its
NPN-canonical representative and expanding gave 7 - a wrong "proof".

Fix: n<=3 (4 and 256 functions) are solved FULLY DIRECTLY, each with its
own independent proof - fast enough (seconds) that the NPN shortcut isn't
needed at all. n=4 (65536 functions) is NOT fully direct-solvable in
session time (measured ~7.5s/function worst-case sample => 65536 functions
is infeasible); for n=4 we solve each of the 222 NPN-canonical
REPRESENTATIVES directly (a true proof for those 222 specific functions
only) and expand to the other ~65314 members via the NPN transform -
labeled "upperBound": true for those (a real, correct, simulated-and-
verified circuit, but NOT claimed as proven-minimal for that specific
member - only the gate list is guaranteed valid).

Output: packages/core/data/exact-min-gate-lib-{n}.json, one entry per
actual truth-table value (decimal string key):
  { "gates": [[a,b],...],      # pool indices: 0=const0,1=const1,
                                # 2..1+n=inputs, 2+n+i=gate i's output
    "depth": d,
    "provenMinGates": r,       # true minimum IFF proven==true
    "proven": true/false,      # true only for n<=3 (all) and n=4's 222
                                # canonical representatives
    "unsatAtRMinus1": true,    # only meaningful when proven==true
    "best": {"gates":[[a,b],...], "r":r2, "depth":d2, "c":C2}
                                # best C=(gates)*max(depth,1)^3 seen over
                                # r_min..r_min+2 via bounded sampling (not
                                # a formal depth-SAT minimization, and for
                                # n=4 non-representatives this also
                                # inherits the upper-bound caveat)
  }
r=0 entries (pure const/raw-input targets): "gates": [].
"""
import itertools
import json
import os
import sys
import time
from pysat.solvers import Glucose3

SAMPLES_PER_R = 5
EXTRA_R_TRIES = 2
MAX_R_CAP = 12


def npn_canonical(tt, n):
    width = 1 << n
    full = (1 << width) - 1
    best = None
    best_tr = None
    for perm in itertools.permutations(range(n)):
        permuted = 0
        for x in range(width):
            src = 0
            for i in range(n):
                if (x >> i) & 1:
                    src |= 1 << perm[i]
            if (tt >> src) & 1:
                permuted |= 1 << x
        for in_neg in range(1 << n):
            negated = 0
            for x in range(width):
                src = x ^ in_neg
                if (permuted >> src) & 1:
                    negated |= 1 << x
            for out_neg in (0, 1):
                cand = negated ^ full if out_neg else negated
                if best is None or cand < best:
                    best = cand
                    best_tr = (perm, in_neg, out_neg)
    return best, best_tr


def base_signal_index(tt, n, width, full):
    if tt == 0:
        return 0
    if tt == full:
        return 1
    for i in range(n):
        v = 0
        for x in range(width):
            if (x >> i) & 1:
                v |= 1 << x
        if tt == v:
            return 2 + i
    return None


class Lit:
    def __init__(self):
        self.n = 0

    def new(self):
        self.n += 1
        return self.n


def solve_at_r(target_bits, n, width, r, pool_base, prev_block=None):
    lit = Lit()
    cnf = []
    sel_vars = {}
    val_vars = {}
    pool_size_at = [pool_base + i for i in range(r)]

    def valOf(idx, k):
        if idx == 0:
            return ("const", 0)
        if idx == 1:
            return ("const", 1)
        if idx < 2 + n:
            return ("const", (k >> (idx - 2)) & 1)
        gidx = idx - (2 + n)
        return ("var", val_vars[(gidx, k)])

    for i in range(r):
        psize = pool_size_at[i]
        pairs = [(p, q) for p in range(psize) for q in range(p, psize)]
        pvars = []
        for (p, q) in pairs:
            v = lit.new()
            sel_vars[(i, p, q)] = v
            pvars.append(v)
        cnf.append(pvars[:])
        for a_idx in range(len(pvars)):
            for b_idx in range(a_idx + 1, len(pvars)):
                cnf.append([-pvars[a_idx], -pvars[b_idx]])
        for k in range(width):
            val_vars[(i, k)] = lit.new()
        for (p, q) in pairs:
            s = sel_vars[(i, p, q)]
            for k in range(width):
                A = val_vars[(i, k)]
                tp, vp = valOf(p, k)
                tq, vq = valOf(q, k)
                if tp == "const" and tq == "const":
                    nand = 1 - (vp & vq)
                    cnf.append([-s, A if nand else -A])
                elif tp == "const" and tq == "var":
                    if vp == 0:
                        cnf.append([-s, A])
                    else:
                        cnf.append([-s, -A, -vq])
                        cnf.append([-s, A, vq])
                elif tp == "var" and tq == "const":
                    if vq == 0:
                        cnf.append([-s, A])
                    else:
                        cnf.append([-s, -A, -vp])
                        cnf.append([-s, A, vp])
                else:
                    cnf.append([-s, -A, -vp, -vq])
                    cnf.append([-s, A, vp])
                    cnf.append([-s, A, vq])

    for k in range(width):
        v = val_vars[(r - 1, k)]
        cnf.append([v if target_bits[k] else -v])
    if prev_block:
        cnf.extend(prev_block)

    with Glucose3(bootstrap_with=cnf) as solver:
        if not solver.solve():
            return None
        model = set(x for x in solver.get_model() if x > 0)
        gates = []
        block_this = []
        for i in range(r):
            psize = pool_size_at[i]
            for (p, q) in [(p, q) for p in range(psize) for q in range(p, psize)]:
                v = sel_vars[(i, p, q)]
                if v in model:
                    gates.append((p, q))
                    block_this.append(-v)
                    break
        return gates, block_this


def circuit_depth(gates, n):
    if not gates:
        return 0
    level = {0: 0, 1: 0}
    for j in range(n):
        level[2 + j] = 0
    for i, (a, b) in enumerate(gates):
        level[2 + n + i] = max(level[a], level[b]) + 1
    return level[2 + n + len(gates) - 1]


def simulate(gates, n, width):
    rows = []
    for x in range(width):
        val = {0: 0, 1: 1}
        for j in range(n):
            val[2 + j] = (x >> j) & 1
        for i, (a, b) in enumerate(gates):
            val[2 + n + i] = 1 - (val[a] & val[b])
        rows.append(val[2 + n + len(gates) - 1] if gates else None)
    return rows


def compute_c(gates_count, depth):
    return gates_count * max(depth, 1) ** 3


def solve_min_gates(tt, n, width, full, pool_base):
    base_idx = base_signal_index(tt, n, width, full)
    if base_idx is not None:
        return {"r_min": 0, "gates": [], "proven": True, "unsat": True}
    target_bits = [(tt >> x) & 1 for x in range(width)]
    for r in range(1, MAX_R_CAP + 1):
        res = solve_at_r(target_bits, n, width, r, pool_base)
        if res is not None:
            return {"r_min": r, "gates": res[0], "proven": True, "unsat": True}
    return {"r_min": None, "gates": None, "proven": False, "unsat": False}


def best_c_search(tt, n, width, r_min, gates0, pool_base):
    """Bounded sampling for best C over r_min..r_min+EXTRA_R_TRIES."""
    target_bits = [(tt >> x) & 1 for x in range(width)]
    best_depth = circuit_depth(gates0, n)
    best_gates = gates0
    block_clauses = []
    for s in range(SAMPLES_PER_R - 1):
        res2 = solve_at_r(target_bits, n, width, r_min, pool_base, prev_block=block_clauses or None)
        if res2 is None:
            break
        g2, blk2 = res2
        block_clauses.append(blk2)
        d2 = circuit_depth(g2, n)
        if d2 < best_depth:
            best_depth, best_gates = d2, g2
    best_r, best_c = r_min, compute_c(r_min, best_depth)
    for extra in range(1, EXTRA_R_TRIES + 1):
        r_try = r_min + extra
        if r_try > MAX_R_CAP:
            break
        res = solve_at_r(target_bits, n, width, r_try, pool_base)
        if res is None:
            continue
        g, _ = res
        cur_d, cur_g = circuit_depth(g, n), g
        block2 = []
        for s in range(SAMPLES_PER_R - 1):
            res2 = solve_at_r(target_bits, n, width, r_try, pool_base, prev_block=block2 or None)
            if res2 is None:
                break
            g2, blk2 = res2
            block2.append(blk2)
            d2 = circuit_depth(g2, n)
            if d2 < cur_d:
                cur_d, cur_g = d2, g2
        c = compute_c(r_try, cur_d)
        if c < best_c:
            best_c, best_r, best_depth, best_gates = c, r_try, cur_d, cur_g
    return {"gates": best_gates, "r": best_r, "depth": best_depth, "c": best_c}


def expand_circuit_for_member(canon_gates, n, perm, in_neg, out_neg):
    new_gates = []
    sig_map = {0: 0, 1: 1}
    eff = {}
    for i in range(n):
        raw_sig = 2 + perm[i]
        if (in_neg >> i) & 1:
            ns = 2 + n + len(new_gates)
            new_gates.append((raw_sig, raw_sig))
            eff[i] = ns
        else:
            eff[i] = raw_sig
    for i in range(n):
        sig_map[2 + i] = eff[i]
    for i, (a, b) in enumerate(canon_gates):
        ma, mb = sig_map[a], sig_map[b]
        ns = 2 + n + len(new_gates)
        new_gates.append((ma, mb))
        sig_map[2 + n + i] = ns
    out_sig = sig_map[2 + n + len(canon_gates) - 1]
    if out_neg:
        new_gates.append((out_sig, out_sig))
    return new_gates


def entry_from_gates(gates, n, width, tt, proven, r_min, best):
    depth = circuit_depth(gates, n)
    return {
        "gates": [list(g) for g in gates],
        "depth": depth,
        "provenMinGates": r_min,
        "proven": proven,
        "unsatAtRMinus1": proven and r_min > 0,
        "best": {
            "gates": [list(g) for g in best["gates"]],
            "r": best["r"],
            "depth": best["depth"],
            "c": best["c"],
        },
    }


def run_direct_full(n, outdir):
    """n<=3: solve every function directly, fully proven."""
    t0 = time.time()
    width = 1 << n
    full = (1 << width) - 1
    pool_base = 2 + n
    lib = {}
    fails = 0
    for tt in range(1 << width):
        sol = solve_min_gates(tt, n, width, full, pool_base)
        if sol["r_min"] is None:
            fails += 1
            sys.stderr.write(f"  n={n} tt={tt}: NO SOLUTION up to r={MAX_R_CAP}\n")
            continue
        gates = sol["gates"]
        rows = simulate(gates, n, width)
        expected = [(tt >> x) & 1 for x in range(width)]
        if gates and rows != expected:
            fails += 1
            sys.stderr.write(f"  n={n} tt={tt}: VERIFICATION FAILED\n")
            continue
        best = best_c_search(tt, n, width, sol["r_min"], gates, pool_base) if gates else {
            "gates": [], "r": 0, "depth": 0, "c": 0
        }
        lib[str(tt)] = entry_from_gates(gates, n, width, tt, True, sol["r_min"], best)
    sys.stderr.write(f"n={n} direct-full: {len(lib)}/{1<<width} OK, {fails} fails ({time.time()-t0:.1f}s)\n")
    path = os.path.join(outdir, f"exact-min-gate-lib-{n}.json")
    with open(path, "w") as f:
        json.dump(lib, f)
    return {"n": n, "classes": None, "functions": len(lib), "failures": fails, "path": path, "mode": "direct-full-proven"}


def perm_canonical(tt, n):
    """Input-PERMUTATION-only canonical form (no negation) - BUILD.md 1c.4's
    correction to 1b.2's NPN approach. Unlike negation, permuting input wires
    adds zero gates, so a solved representative's gate count/depth is EXACT
    (not just a valid upper bound) for every member of its orbit - every
    expanded entry below is proven:true."""
    width = 1 << n
    best, best_perm = None, None
    for perm in itertools.permutations(range(n)):
        permuted = 0
        for x in range(width):
            src = 0
            for i in range(n):
                if (x >> i) & 1:
                    src |= 1 << perm[i]
            if (tt >> src) & 1:
                permuted |= 1 << x
        if best is None or permuted < best:
            best, best_perm = permuted, perm
    return best, best_perm


def run_perm_representatives(n, outdir, time_budget_s, progress_every=25):
    """n=4, BUILD.md 1c.4: permutation-only classes (3984 for n=4), each
    solved directly and PROVEN (see perm_canonical's note - this is the fix
    for 1b.2's NPN bug, not another instance of it). Hard-timeboxed: if
    time_budget_s is exceeded before all classes solve, returns
    complete=False and writes NOTHING to disk (BUILD.md: "ship nothing
    partial"). Progress is still logged to stderr throughout."""
    t0 = time.time()
    width = 1 << n
    full = (1 << width) - 1
    pool_base = 2 + n

    members = {}
    classes = {}
    for tt in range(1 << width):
        canon, perm = perm_canonical(tt, n)
        members[tt] = (canon, perm)
        classes.setdefault(canon, []).append(tt)
    sys.stderr.write(f"n={n}: {len(classes)} permutation-only classes over {1<<width} functions\n")

    class_sol = {}
    sorted_classes = sorted(classes.keys())
    for ci, canon in enumerate(sorted_classes):
        if time.time() - t0 > time_budget_s:
            sys.stderr.write(
                f"TIMEOUT at class {ci}/{len(sorted_classes)} after {time.time()-t0:.0f}s - "
                f"incomplete, shipping NOTHING per BUILD.md 1c.4\n"
            )
            return {"n": n, "complete": False, "classes_done": ci, "classes_total": len(sorted_classes),
                    "elapsed_s": time.time() - t0, "path": None}
        sol = solve_min_gates(canon, n, width, full, pool_base)
        if sol["r_min"] is None:
            sys.stderr.write(f"  class {canon}: NO SOLUTION, skipping\n")
            continue
        gates = sol["gates"]
        rows = simulate(gates, n, width)
        expected = [(canon >> x) & 1 for x in range(width)]
        if gates and rows != expected:
            sys.stderr.write(f"  class {canon}: VERIFICATION FAILED, skipping\n")
            continue
        best = best_c_search(canon, n, width, sol["r_min"], gates, pool_base) if gates else {
            "gates": [], "r": 0, "depth": 0, "c": 0
        }
        class_sol[canon] = {"r_min": sol["r_min"], "gates": gates, "best": best}
        if (ci + 1) % progress_every == 0:
            elapsed = time.time() - t0
            rate = elapsed / (ci + 1)
            eta = rate * (len(sorted_classes) - ci - 1)
            sys.stderr.write(f"  class {ci+1}/{len(sorted_classes)} solved ({elapsed:.0f}s elapsed, ETA {eta:.0f}s)\n")

    # All classes solved within budget - expand (lossless permutation remap, EXACT for every member).
    lib = {}
    fails = 0
    for tt in range(1 << width):
        canon, perm = members[tt]
        sol = class_sol.get(canon)
        if sol is None:
            fails += 1
            continue
        gates = expand_circuit_for_member(sol["gates"], n, perm, 0, 0) if sol["gates"] else []
        expected = [(tt >> x) & 1 for x in range(width)]
        rows = simulate(gates, n, width) if gates else None
        ok = (not gates) or rows == expected
        if not gates:
            ok = base_signal_index(tt, n, width, full) is not None
        best_gates = expand_circuit_for_member(sol["best"]["gates"], n, perm, 0, 0) if sol["best"]["gates"] else []
        if best_gates:
            ok = ok and simulate(best_gates, n, width) == expected
        if not ok:
            fails += 1
            continue
        entry = entry_from_gates(
            gates, n, width, tt, True, sol["r_min"], {
                "gates": best_gates, "r": len(best_gates),
                "depth": circuit_depth(best_gates, n),
                "c": compute_c(len(best_gates) or 1, circuit_depth(best_gates, n)) if best_gates else 0,
            }
        )
        entry["unsatAtRMinus1"] = True  # exact for EVERY member, not just the representative - see perm_canonical
        lib[str(tt)] = entry

    elapsed = time.time() - t0
    sys.stderr.write(f"n={n} perm-representatives COMPLETE: {len(lib)}/{1<<width} OK, {fails} fails ({elapsed:.0f}s)\n")
    path = os.path.join(outdir, f"exact-min-gate-lib-{n}.json")
    with open(path, "w") as f:
        json.dump(lib, f)
    return {"n": n, "complete": True, "classes": len(classes), "functions": len(lib),
            "failures": fails, "elapsed_s": elapsed, "path": path, "mode": "perm-only-proven-exact"}


def run_npn_representatives(n, outdir, progress_every=10):
    """n=4: NPN-reduce to classes, solve each REPRESENTATIVE directly
    (proven for that function only), expand to all members (upper bound
    for non-representatives, clearly labeled)."""
    t0 = time.time()
    width = 1 << n
    full = (1 << width) - 1
    pool_base = 2 + n

    members = {}
    classes = {}
    for tt in range(1 << width):
        canon, tr = npn_canonical(tt, n)
        members[tt] = (canon,) + tr
        classes.setdefault(canon, []).append(tt)
    sys.stderr.write(f"n={n}: {len(classes)} NPN classes over {1<<width} functions\n")

    class_sol = {}
    for ci, canon in enumerate(sorted(classes.keys())):
        sol = solve_min_gates(canon, n, width, full, pool_base)
        if sol["r_min"] is None:
            sys.stderr.write(f"  class {canon}: NO SOLUTION, skipping\n")
            continue
        gates = sol["gates"]
        rows = simulate(gates, n, width)
        expected = [(canon >> x) & 1 for x in range(width)]
        if gates and rows != expected:
            sys.stderr.write(f"  class {canon}: VERIFICATION FAILED, skipping\n")
            continue
        best = best_c_search(canon, n, width, sol["r_min"], gates, pool_base) if gates else {
            "gates": [], "r": 0, "depth": 0, "c": 0
        }
        class_sol[canon] = {"r_min": sol["r_min"], "gates": gates, "best": best}
        if (ci + 1) % progress_every == 0 or ci == len(classes) - 1:
            sys.stderr.write(f"  class {ci+1}/{len(classes)} solved ({time.time()-t0:.1f}s)\n")

    lib = {}
    fails = 0
    upper_bound_count = 0
    for tt in range(1 << width):
        canon, perm, in_neg, out_neg = members[tt]
        sol = class_sol.get(canon)
        if sol is None:
            fails += 1
            continue
        is_representative = tt == canon

        def expand(g):
            if not g:
                return []
            return expand_circuit_for_member(g, n, perm, in_neg, out_neg)

        gates = expand(sol["gates"])
        expected = [(tt >> x) & 1 for x in range(width)]
        rows = simulate(gates, n, width) if gates else None
        ok = (not gates) or rows == expected
        if not gates:
            ok = base_signal_index(tt, n, width, full) is not None
        best_gates = expand(sol["best"]["gates"])
        if best_gates:
            rows2 = simulate(best_gates, n, width)
            ok = ok and rows2 == expected
        if not ok:
            fails += 1
            continue

        proven = is_representative
        if not proven:
            upper_bound_count += 1
        entry = entry_from_gates(
            gates, n, width, tt, proven, sol["r_min"] if proven else len(gates), {
                "gates": best_gates, "r": sol["best"]["r"] if proven else len(best_gates),
                "depth": circuit_depth(best_gates, n), "c": compute_c(len(best_gates) or 1, circuit_depth(best_gates, n)) if best_gates else 0,
            }
        )
        entry["unsatAtRMinus1"] = proven
        lib[str(tt)] = entry

    sys.stderr.write(
        f"n={n} npn-representatives: {len(lib)}/{1<<width} OK "
        f"({len(classes)} proven representatives, {upper_bound_count} upper-bound expansions), "
        f"{fails} fails ({time.time()-t0:.1f}s)\n"
    )
    path = os.path.join(outdir, f"exact-min-gate-lib-{n}.json")
    with open(path, "w") as f:
        json.dump(lib, f)
    return {
        "n": n, "classes": len(classes), "functions": len(lib),
        "proven_representatives": len(classes), "upper_bound_expansions": upper_bound_count,
        "failures": fails, "path": path, "mode": "npn-representatives-proven-rest-upper-bound",
    }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--perm4":
        outdir = sys.argv[2]
        budget_s = float(sys.argv[3])
        r = run_perm_representatives(4, outdir, budget_s)
        print(json.dumps(r, indent=2))
        sys.exit(0 if r["complete"] else 1)

    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    ns = [int(x) for x in sys.argv[2:]] if len(sys.argv) > 2 else [1, 2, 3, 4]
    summary = {}
    for n in ns:
        if n <= 3:
            r = run_direct_full(n, outdir)
        else:
            r = run_npn_representatives(n, outdir)
        summary[n] = r
        print(f"n={n}: {json.dumps(r)}")
    print(json.dumps(summary, indent=2))
