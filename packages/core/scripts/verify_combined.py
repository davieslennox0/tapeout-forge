import json, urllib.request

rows = json.load(open('/tmp/tapeout_calldata.json'))
bank = {t['id']: t for t in json.load(open('docs/fabx-tasks.json'))['tasks']}

def fetch_vectors(tid):
    url = f"https://api.fabx.tech/v1/pod/tasks/{tid}/vectors?chainId=196"
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read())['vectors']

def parse_netlist(hexstr, nIn, nOut):
    b = bytes.fromhex(hexstr[2:])
    gates = []
    i = 0
    while i < len(b):
        op = b[i]
        if op == 0x00:
            a = int.from_bytes(b[i+1:i+4], 'big')
            bb = int.from_bytes(b[i+4:i+7], 'big')
            gates.append((a, bb))
            i += 7
        else:
            raise ValueError(f"unexpected opcode {op}")
    return gates

def simulate(gates, nIn, inp):
    sig = [0]*(2+nIn+len(gates))
    sig[1] = 1
    for i in range(nIn):
        sig[2+i] = (inp >> i) & 1
    for gi,(a,b) in enumerate(gates):
        sig[2+nIn+gi] = 1 - (sig[a] & sig[b])
    nOut_signals = sig[2+nIn+len(gates)-len(gates):]  # unused
    return sig

all_ok = True
for r in rows:
    tid = r['id']; nIn = r['nIn']; nOut = r['nOut']
    t = bank[tid]
    vecs = fetch_vectors(tid)
    mask = (1<<nIn) - 1
    expected = {}
    for v in vecs:
        inp = int(v['input'],16) & mask
        expected[inp] = int(v['expectedOut'],16)

    gates = parse_netlist(r['hex'], nIn, nOut)
    totalGates = len(gates)
    nOutStart = 2 + nIn + totalGates - nOut
    mism = 0
    for inp in range(1<<nIn):
        sig = simulate(gates, nIn, inp)
        got = 0
        for k in range(nOut):
            got |= sig[nOutStart+k] << k
        want = expected[inp]
        if got != want:
            mism += 1
            if mism <= 3:
                print(f"  task {tid} inp={inp}: got={got:#x} want={want:#x}")
    status = "OK" if mism == 0 else f"MISMATCH ({mism}/{1<<nIn})"
    if mism: all_ok = False
    print(f"task {tid} ({t['name']}): nIn={nIn} nOut={nOut} gates={totalGates} -> {status}")

print()
print("ALL COMBINED NETLISTS CORRECT" if all_ok else "FOUND REAL BUGS IN COMBINATION LOGIC")
