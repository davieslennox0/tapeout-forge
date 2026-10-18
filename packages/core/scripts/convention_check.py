import json

dump = json.load(open('/tmp/all46_dump.json'))

def circuit_depth(gates):
    depth = []
    nIn_plus_consts = None
    return depth

def compute_gates_depth(perOutput, nIn):
    totalGates = 0
    maxDepth = 0
    for out in perOutput:
        gates = out['gates']
        totalGates += len(gates)
        d = [0]*(2+nIn)
        for g in gates:
            d.append(max(d[g['a']], d[g['b']]) + 1)
        dep = max(d[2+nIn:]) if gates else 0
        maxDepth = max(maxDepth, dep)
    return totalGates, maxDepth

def verdict(c, cref):
    if c < cref: return 'beat'
    if c == cref: return 'tie'
    return 'lose'

flips = []
rows = []
for t in dump:
    tid = t['id']; nOut = t['nOut']; nIn = t['nIn']; cref = t['Cref']
    gates, depth = compute_gates_depth(t['perOutput'], nIn)

    A_wb = gates + 2*nOut
    C_wb = A_wb * max(depth + 2, 1)**3
    v_wb = verdict(C_wb, cref)

    A_nb = gates
    C_nb = A_nb * max(depth, 1)**3
    v_nb = verdict(C_nb, cref)

    rows.append((tid, gates, depth, cref, C_wb, v_wb, C_nb, v_nb))
    if v_wb != v_nb:
        flips.append((tid, v_wb, v_nb, C_wb, C_nb, cref))

print(f"{'id':>3} {'g':>4} {'d':>3} {'Cref':>8} {'C(withbuf)':>11} {'v_wb':>5} {'C(nobuf)':>10} {'v_nb':>5}")
for r in rows:
    print(f"{r[0]:>3} {r[1]:>4} {r[2]:>3} {r[3]:>8} {r[4]:>11} {r[5]:>5} {r[6]:>10} {r[7]:>5}")

print()
print(f"Tasks whose verdict FLIPS between conventions: {len(flips)}/{len(rows)}")
for f in flips:
    print(" ", f)

wb_counts = {}
nb_counts = {}
for r in rows:
    wb_counts[r[5]] = wb_counts.get(r[5],0)+1
    nb_counts[r[7]] = nb_counts.get(r[7],0)+1
print()
print("with-buffers counts:", wb_counts)
print("no-buffers    counts:", nb_counts)
