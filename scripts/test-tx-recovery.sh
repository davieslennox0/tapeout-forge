#!/usr/bin/env bash
# Offline test for scripts/lib-tx.sh: no network, no keys, no chain. A stub `cast` replays the
# real failure modes seen on the public X Layer RPC ("null response" after a tx mined, a null
# before it was sent, receipts that stay null for a while, a reverted tx).
# Run: bash scripts/test-tx-recovery.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STUB=$(mktemp -d); trap 'rm -rf "$STUB"' EXIT
export STUB TX_POLL_SLEEP=0 TX_WAIT_TRIES=5
cat > "$STUB/cast" <<'STUBEOF'
#!/usr/bin/env bash
# Behaviour is driven by files in $STUB: send_mode (err|ok), nonce, logs.json, receipt_nulls, receipt_status
cmd="$1"; shift
case "$cmd" in
  send)   if [ "$(cat "$STUB/send_mode")" = "ok" ]; then echo "0x$(printf 'ab%.0s' $(seq 32))"; exit 0; fi
          echo "Error: server returned a null response when a non-null response was expected" >&2; exit 1 ;;
  nonce)  cat "$STUB/nonce" ;;
  block-number) echo 1000 ;;
  rpc)    m="$1"; shift
          if [ "$m" = "eth_getLogs" ]; then cat "$STUB/logs.json"
          elif [ "$m" = "eth_getTransactionReceipt" ]; then
            n=$(cat "$STUB/receipt_nulls"); if [ "$n" -gt 0 ]; then echo $((n-1)) > "$STUB/receipt_nulls"; echo null; exit 0; fi
            [ "$(cat "$STUB/receipt_status")" = "none" ] && { echo null; exit 0; }
            echo "{\"status\":\"$(cat "$STUB/receipt_status")\",\"logs\":[]}"
          fi ;;
esac
STUBEOF
chmod +x "$STUB/cast"
export CAST="$STUB/cast" RPC="stub"
# shellcheck source=scripts/lib-tx.sh
. "$ROOT/scripts/lib-tx.sh"

ME="0x000000000000000000000000155d4248621bf2601a9f9171327b8081d302b171"
OTHER="0x0000000000000000000000001f4d4b97d9cfd57b2f5ccee3c4ea5e5e5e5e5e5e"
T0="0xc11215e417669c143c8a07aeb778034c0a0a85ebdf305d64a629b19a7a9ce031"
HASH="0x$(printf 'cd%.0s' $(seq 32))"
mklog() { printf '[{"transactionHash":"%s","topics":["%s","0x000000000000000000000000000000000000000000000000000000000000000d","%s"]}]' "$HASH" "$T0" "$1"; }
PASS=0; FAIL=0
ok()  { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1 (got: $2)"; FAIL=$((FAIL+1)); }
setup() { echo "$1" > "$STUB/send_mode"; echo "$2" > "$STUB/nonce"; echo "$3" > "$STUB/logs.json"; echo "$4" > "$STUB/receipt_nulls"; echo "$5" > "$STUB/receipt_status"; }
run() { OUT=$(send_and_confirm tapeout 0xME 5 0xPROC "$T0" 990 "2=$ME" -- 0xPROC "tapeout()" 2>"$STUB/err"); RC=$?; }

echo "== 1. send returned null AFTER the tx mined: recovered from its event, circuit id returned"
setup err 6 "$(mklog "$ME")" 0 none; run
{ [ $RC -eq 0 ] && [ "${OUT%% *}" = "$HASH" ] && [ "${OUT#* }" != "$OUT" ]; } && ok "recovered tx $HASH with its circuit-id topic" || bad "rc=$RC" "$OUT"

echo "== 2. send returned null BEFORE anything was sent, nonce unchanged: reported as safe to retry (rc 4)"
setup err 5 "[]" 0 none; run
[ $RC -eq 4 ] && grep -q "Safe to retry" "$STUB/err" && ok "rc 4 and 'Safe to retry'" || bad "rc=$RC" "$(cat "$STUB/err")"

echo "== 3. send errored, nonce advanced, no event found: refuses to say 'retry' (rc 3)"
setup err 6 "[]" 0 none; run
[ $RC -eq 3 ] && grep -q "Investigate" "$STUB/err" && ok "rc 3 and 'Investigate'" || bad "rc=$RC" "$(cat "$STUB/err")"

echo "== 4. an event from ANOTHER sender is never recovered as ours"
setup err 5 "$(mklog "$OTHER")" 0 none; run
[ $RC -eq 4 ] && ok "other sender's event ignored (rc 4)" || bad "rc=$RC" "$OUT"

echo "== 5. send ok, receipt reads return null three times, then success: waits and confirms"
setup ok 6 "[]" 3 0x1; run
[ $RC -eq 0 ] && ok "confirmed after tolerating 3 null receipt replies" || bad "rc=$RC" "$OUT"

echo "== 6. send ok, tx mined but reverted (status 0x0): rc 1"
setup ok 6 "[]" 0 0x0; run
[ $RC -eq 1 ] && ok "revert reported (rc 1)" || bad "rc=$RC" "$OUT"

echo "== 7. send ok, receipt stays null for the whole wait, but the event exists: confirmed via the event"
setup ok 6 "$(mklog "$ME")" 0 none; run
[ $RC -eq 0 ] && grep -q "RECOVERED" "$STUB/err" && ok "confirmed by event when receipts stay null" || bad "rc=$RC" "$(cat "$STUB/err")"

echo "== 8. send ok, receipt null for the whole wait, no event: rc 2 (unconfirmed), not a false success"
setup ok 6 "[]" 0 none; run
[ $RC -eq 2 ] && ok "unconfirmed reported (rc 2)" || bad "rc=$RC" "$OUT"

echo; echo "== $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
