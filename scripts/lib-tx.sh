#!/usr/bin/env bash
# Sourced by tapeout.sh (and testable on its own). Needs $CAST and $RPC.
#
# Why this exists: a real run on the public multi-node X Layer RPC twice returned
# "server returned a null response when a non-null response was expected" AFTER the tape-out had
# already mined, and once BEFORE the tx was sent. `cast send` (which blocks for a receipt) cannot
# tell those apart, so the script reported failure either way. Here the send is split from the
# wait: send with --async (hash only), poll the receipt tolerantly (a null or error reply just
# means "not yet"), and if the send itself errors, look the tx up on-chain by its event before
# reporting anything.

# Raw receipt JSON, or nothing for a null/errored reply. Never blocks (cast receipt does).
tx_receipt_json() {
  local r
  r=$("$CAST" rpc eth_getTransactionReceipt "$1" --rpc-url "$RPC" 2>/dev/null) || return 1
  [ -n "$r" ] && [ "$r" != "null" ] && echo "$r"
  return 0
}

# Prints 1 (mined, success), 0 (mined, reverted) or nothing (unknown yet).
tx_status() {
  local r s
  r=$(tx_receipt_json "$1") || return 0
  [ -n "$r" ] || return 0
  s=$(echo "$r" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  case "$s" in 0x1|1) echo 1 ;; 0x0|0) echo 0 ;; esac
}

# find_tx_by_event <address> <topic0> <from_block> <idx=0xvalue>...
# Scans eth_getLogs (the RPC caps a call at ~100 blocks) from <from_block> to the head and prints
# "<txhash> <topic1>" for the newest log whose topics match every idx=value filter.
find_tx_by_event() {
  local addr="$1" t0="$2" from="$3"; shift 3
  CAST="$CAST" RPC="$RPC" python3 - "$addr" "$t0" "$from" "$@" <<'PY'
import json, os, subprocess, sys
cast, rpc = os.environ["CAST"], os.environ["RPC"]
addr, t0, frm = sys.argv[1], sys.argv[2].lower(), int(sys.argv[3])
want = {}
for a in sys.argv[4:]:
    i, v = a.split("=", 1); want[int(i)] = v.lower()
def run(*a):
    p = subprocess.run([cast, *a, "--rpc-url", rpc], capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 else ""
head = run("block-number")
if not head.isdigit(): sys.exit(0)
head = int(head); best = None
lo = frm
while lo <= head:
    hi = min(lo + 90, head)
    out = run("rpc", "eth_getLogs", json.dumps({"fromBlock": hex(lo), "toBlock": hex(hi), "address": addr}))
    try: logs = json.loads(out) if out else []
    except ValueError: logs = []
    for l in logs:
        t = [x.lower() for x in l["topics"]]
        if t and t[0] == t0 and all(len(t) > i and t[i] == v for i, v in want.items()):
            best = (l["transactionHash"], t[1] if len(t) > 1 else "")
    lo = hi + 1
if best: print(best[0], best[1])
PY
}

# wait_tx_status <hash> [tries]  -> 0 mined+success, 1 mined+reverted, 2 still unknown after the wait
wait_tx_status() {
  local h="$1" tries="${2:-30}" n=0 s
  while [ "$n" -lt "$tries" ]; do
    s=$(tx_status "$h")
    [ "$s" = "1" ] && return 0
    [ "$s" = "0" ] && return 1
    n=$((n + 1)); sleep "${TX_POLL_SLEEP:-2}"
  done
  return 2
}

# send_and_confirm <label> <sender> <start_nonce> <event_addr> <event_topic0> <from_block> <idx=val...> -- <cast send args...>
# Prints "<txhash> <topic1>" on stdout (topic1 is only filled when recovered via the event).
# Return codes: 0 confirmed | 1 mined but reverted | 2 sent but unconfirmable after the wait
#               3 send errored, nonce advanced, tx not found: INVESTIGATE, do not retry blindly
#               4 send errored and nothing was sent (nonce unchanged): safe to retry
send_and_confirm() {
  local label="$1" sender="$2" start_nonce="$3" ev_addr="$4" ev_t0="$5" from_block="$6"; shift 6
  local filters=()
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do filters+=("$1"); shift; done
  shift
  local out rc hash rec now
  out=$("$CAST" send "$@" --async --rpc-url "$RPC" 2>&1); rc=$?
  hash=$(echo "$out" | grep -oE '0x[0-9a-fA-F]{64}' | head -1)
  if [ "$rc" -ne 0 ] || [ -z "$hash" ]; then
    echo "WARN [$label]: send returned an error ($(echo "$out" | head -1 | cut -c1-120)). Checking the chain before reporting failure." >&2
    sleep "${TX_POLL_SLEEP:-2}"
    rec=$(find_tx_by_event "$ev_addr" "$ev_t0" "$from_block" "${filters[@]}")
    if [ -n "$rec" ]; then
      echo "RECOVERED [$label]: the tx did mine; found by its on-chain event: ${rec%% *}" >&2
      echo "$rec"; return 0
    fi
    now=$("$CAST" nonce "$sender" --rpc-url "$RPC" 2>/dev/null || echo "")
    if [ -n "$start_nonce" ] && [ -n "$now" ] && [ "$now" -gt "$start_nonce" ] 2>/dev/null; then
      echo "ABORT [$label]: nonce advanced ($start_nonce -> $now) but no matching event was found. Investigate before retrying." >&2
      return 3
    fi
    echo "FAILED [$label]: nothing was sent (nonce unchanged). Safe to retry." >&2
    return 4
  fi
  wait_tx_status "$hash" "${TX_WAIT_TRIES:-30}"; rc=$?
  if [ "$rc" -eq 0 ]; then echo "$hash"; return 0; fi
  if [ "$rc" -eq 1 ]; then echo "ABORT [$label]: tx $hash was mined but reverted." >&2; echo "$hash"; return 1; fi
  rec=$(find_tx_by_event "$ev_addr" "$ev_t0" "$from_block" "${filters[@]}")
  if [ -n "$rec" ]; then echo "RECOVERED [$label]: receipt reads stayed null but the event exists for ${rec%% *}" >&2; echo "$rec"; return 0; fi
  echo "ABORT [$label]: tx $hash is not confirmed after the wait and no event was found." >&2
  echo "$hash"; return 2
}
