import json, urllib.request

dump = json.load(open('/tmp/beats_dump.json'))
# (id, name, Cref) from docs/fabx-tasks.json (metadata only, not vectors)
bank = json.load(open('docs/fabx-tasks.json'))['tasks']
meta = {t['id']: t for t in bank}

def fetch_vectors(tid):
    url = f"https://api.fabx.tech/v1/pod/tasks/{tid}/vectors?chainId=196"
    with urllib.request.urlopen(url, timeout=20) as r:
        d = json.loads(r.read())
    return d['vectors']

def simulate(gates, nIn, inp):
    # signal 0=const0, 1=const1, 2..1+nIn=inputs, then one per gate (NAND only, no LATCH here)
    sig = [0]*(2+nIn+len(gates))
    sig[0] = 0
    sig[1] = 1
    for i in range(nIn):
        sig[2+i] = (inp >> i) & 1
    for gi, g in enumerate(gates):
        a = sig[g['a']]
        b = sig[g['b']]
        sig[2+nIn+gi] = 1 - (a & b)
    return sig[-1]  # last gate's output = this output bit

def circuit_depth(gates, nIn):
    depth = [0]*(2+nIn)  # consts+inputs have depth 0
    for g in gates:
        da = depth[g['a']]
        db = depth[g['b']]
        depth.append(max(da, db) + 1)
    return max(depth[2+nIn:]) if gates else 0

mismatches = []
cost_mismatches = []
results = []

for task in dump:
    tid = task['id']
    nIn = task['nIn']
    nOut = task['nOut']
    vecs = fetch_vectors(tid)
    mask = (1 << nIn) - 1
    expected = {}
    for v in vecs:
        inp = int(v['input'], 16) & mask
        out = int(v['expectedOut'], 16)
        expected[inp] = out

    ok = True
    totalGates = 0
    maxDepth = 0
    for k in range(nOut):
        gates = task['perOutput'][k]['gates']
        totalGates += len(gates)
        d = circuit_depth(gates, nIn)
        maxDepth = max(maxDepth, d)
        for inp in range(1 << nIn):
            got = simulate(gates, nIn, inp)
            want = (expected[inp] >> k) & 1
            if got != want:
                mismatches.append((tid, k, inp, got, want))
                ok = False

    Cref = meta[tid]['Cref']
    A = totalGates + 2*nOut
    ourC = A * max(maxDepth + 2, 1)**3
    results.append((tid, totalGates, maxDepth, ourC, Cref))
    print(f"task {tid}: nIn={nIn} nOut={nOut} gates={totalGates} depth={maxDepth} "
          f"independentC={ourC} Cref={Cref} truthtable={'OK' if ok else 'MISMATCH'}")

print()
print(f"Total mismatches (truth table): {len(mismatches)}")
for m in mismatches[:20]:
    print("  MISMATCH", m)
print()
print("Independent C recompute vs FABX-REPLAY.md's reported bestC (should match or we flag it):")
