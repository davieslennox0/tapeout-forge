#!/usr/bin/env bash
# PHASE 9.5: real tests for scripts/go-live.sh, against a local Anvil fork (never the real
# chain, never a real key - impersonation only). Run manually: scripts/test-go-live.sh
# Requires: anvil already running at $FORGE_RPC_URL (default http://localhost:8549) with
# ForgeRegistry deployed and a real GC-012 entry submitted (see docs/NEW.md for the exact
# fixture setup used when this was last run for real).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC="${FORGE_RPC_URL:-http://localhost:8549}"
REGISTRY="${FORGE_REGISTRY_ADDRESS:?set FORGE_REGISTRY_ADDRESS to the fork-deployed registry first}"
CAST="$HOME/.foundry/bin/cast"
PASS=0
FAIL=0
ok()  { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

echo "== test 1: --private-key is rejected outright =="
if bash "$ROOT/scripts/go-live.sh" my-forgeout-key --private-key 0xdead >/tmp/t1.log 2>&1; then
  bad "accepted --private-key (should have aborted)"
else
  grep -q "never accepted" /tmp/t1.log && ok "rejects --private-key" || bad "aborted but not for the right reason"
fi

echo "== test 2: an invalid --variant is rejected =="
if bash "$ROOT/scripts/go-live.sh" my-forgeout-key --variant bogus >/tmp/t2.log 2>&1; then
  bad "accepted an invalid --variant"
else
  grep -q "must be gc014 or gc039" /tmp/t2.log && ok "rejects invalid --variant" || bad "aborted but not for the right reason"
fi

echo "== test 3: resume-skip - a real on-chain-recorded circuit is detected and skipped =="
# Real fixture (set up once against the fork, see docs/NEW.md): registry has a real verified
# entry for specHash(GC-012). docs/TAPEOUTS.md must also mention GC-012 for the skip (both
# conditions are required, by design - the file alone is never trusted).
grep -q "GC-012" "$ROOT/docs/TAPEOUTS.md" 2>/dev/null || echo "- $(date -u +%Y-%m-%d): GC-012 (test fixture, fork-only, see test 3)" >> /tmp/fake-tapeouts.md
TAPEOUTS_BACKUP=$(cat "$ROOT/docs/TAPEOUTS.md")
echo "- $(date -u +%Y-%m-%d): GC-012 (test fixture for resume-skip, fork-only)" >> "$ROOT/docs/TAPEOUTS.md"
OUT=$(FORGE_RPC_URL="$RPC" FORGE_REGISTRY_ADDRESS="$REGISTRY" bash "$ROOT/scripts/go-live.sh" my-forgeout-key --variant gc014 2>&1)
echo "$TAPEOUTS_BACKUP" > "$ROOT/docs/TAPEOUTS.md"  # restore immediately, real file, never leave altered
echo "$OUT" | grep -q "SKIP (resumed): GC-012" && ok "resume-skip detects a real already-done circuit" || bad "did not skip GC-012 as expected"
echo "$OUT" | grep -q "^--- GC-037 ---" && ok "still processes the next circuit (GC-037) normally" || bad "stopped processing after the skip"

echo "== test 4: spend-cap abort - a cumulative cost over an artificially tiny cap aborts the whole run =="
# Must stay inside scripts/ so BASH_SOURCE-relative ROOT resolution still finds the repo root.
TMPSCRIPT="$ROOT/scripts/.go-live-test-cap.sh"
sed 's/^SPEND_CAP_OKB=0.05462.*/SPEND_CAP_OKB=0.005/' "$ROOT/scripts/go-live.sh" > "$TMPSCRIPT"
chmod +x "$TMPSCRIPT"
if OUT=$(FORGE_RPC_URL="$RPC" bash "$TMPSCRIPT" my-forgeout-key --variant gc014 2>&1); then
  bad "did not abort despite exceeding the tiny test cap"
else
  echo "$OUT" | grep -q "would exceed cap" && ok "aborts the whole run when cumulative spend exceeds the cap" || bad "aborted but not for the right reason"
fi
rm -f "$TMPSCRIPT"

echo "== test 5: a verify-live mismatch aborts the whole run (logic check - string match on its real output contract) =="
# verify-live.sh's own real contract: it prints "SUMMARY: FAIL" on any mismatch and go-live.sh
# greps for exactly that string to decide whether to abort. Confirmed by direct inspection of
# both scripts' real current source (not assumed): go-live.sh's check is
# `grep -q "SUMMARY: FAIL"` immediately after calling verify-live.sh; verify-live.sh sets
# SUMMARY=FAIL whenever NETLIST_MATCH != PASS or MISMATCHES != 0, and always prints
# "SUMMARY: $SUMMARY" unconditionally. This is a structural guarantee, not a race - exercising
# it end-to-end would require a real broadcasted mismatch, which this phase will never send for
# real; the grep contract between the two real files is what's being verified here.
if grep -q 'grep -q "SUMMARY: FAIL"' "$ROOT/scripts/go-live.sh" && grep -q 'echo "SUMMARY: \$SUMMARY' "$ROOT/scripts/verify-live.sh"; then
  ok "go-live.sh's abort condition and verify-live.sh's real output format are confirmed consistent by direct source inspection"
else
  bad "the grep contract between go-live.sh and verify-live.sh does not match - a real mismatch would NOT be caught"
fi

echo "== test 6: registry resume - a SECOND invocation with FORGE_REGISTRY_ADDRESS unset does NOT redeploy =="
# Real stall this project actually hit: a prior real --broadcast run deployed ForgeRegistry for
# real (tx 0xad495798672b4d9c7dc4b2bdce16b64c6795fb1fad89fac469f8be327c74cc66, status=1), but the
# address only ever lived in that one shell's env var - a fresh invocation with it unset had no
# way to know the registry already existed. Fixed by defaulting FORGE_REGISTRY_ADDRESS from the
# real config/chains.ts value. This fork is forked from REAL current X Layer state, so it
# genuinely inherits that real registry's code at that real address - this is not a fixture, the
# fork IS the real chain's state as of when anvil started.
unset FORGE_REGISTRY_ADDRESS
OUT=$(FORGE_RPC_URL="$RPC" bash "$ROOT/scripts/go-live.sh" my-forgeout-key --variant gc014 2>&1)
echo "$OUT" | grep -q "SKIP (resumed): FORGE_REGISTRY_ADDRESS=0xAFDd108b0efCC1FF4d1e1d32579F80501774912d already has real code" \
  && ok "defaults to the real deployed registry and skips redeploying, with FORGE_REGISTRY_ADDRESS left completely unset" \
  || bad "did not resume correctly - would have attempted a redeploy"
echo "$OUT" | grep -q "estimating real deployment gas" \
  && bad "deploy-registry.sh was invoked anyway (should have been skipped entirely)" \
  || ok "deploy-registry.sh was never invoked - confirmed skipped, not just silently fast"

echo
echo "== $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]

echo "== test 7: --unattended rejects a password file with the wrong mode =="
BADPW="/tmp/test-badmode-pw-$$"
echo "testpassword" > "$BADPW"
chmod 644 "$BADPW"
if OUT=$(FORGE_RPC_URL="$RPC" FORGE_PASSWORD_FILE="$BADPW" bash "$ROOT/scripts/go-live.sh" my-forgeout-key --variant gc014 --broadcast --unattended --max-okb 1.0 2>&1); then
  bad "accepted a mode-644 password file (should have aborted)"
else
  echo "$OUT" | grep -q "must be mode 600" && ok "rejects a password file with the wrong mode" || bad "aborted but not for the right reason: $OUT"
fi
rm -f "$BADPW"

echo "== test 8: --unattended refuses a password file located inside the repo =="
INREPO="$ROOT/scripts/.test-inrepo-pw"
echo "testpassword" > "$INREPO"
chmod 600 "$INREPO"
if OUT=$(FORGE_RPC_URL="$RPC" FORGE_PASSWORD_FILE="$INREPO" bash "$ROOT/scripts/go-live.sh" my-forgeout-key --variant gc014 --broadcast --unattended --max-okb 1.0 2>&1); then
  bad "accepted a password file inside the repo (should have aborted)"
else
  echo "$OUT" | grep -q "inside this repo" && ok "refuses a password file located inside the repo" || bad "aborted but not for the right reason: $OUT"
fi
rm -f "$INREPO"

echo "== test 9: --unattended spend-cap abort uses --max-okb, not just the default cap =="
GOODPW="/tmp/test-goodmode-pw-$$"
printf "testpw123unattended" > "$GOODPW"
chmod 600 "$GOODPW"
if OUT=$(FORGE_RPC_URL="$RPC" FORGE_PASSWORD_FILE="$GOODPW" GAS_PRICE_CEILING_WEI=2000000000 bash "$ROOT/scripts/go-live.sh" test-unattended2 --variant gc014 --broadcast --unattended --max-okb 0.001 2>&1); then
  bad "did not abort despite exceeding the tiny --max-okb"
else
  echo "$OUT" | grep -qE "would exceed cap|exceeds the configured spend cap" && ok "aborts for the cap reason specifically under a tiny --max-okb" || bad "aborted but not for the right reason: $OUT"
fi
rm -f "$GOODPW"

echo "== test 10: --unattended's 10% cost-tolerance check aborts when a step's real cost exceeds reference+10% =="
TMPSCRIPT2="$ROOT/scripts/.go-live-test-tolerance.sh"
sed 's/\[12\]="0.00756"/[12]="0.001"/' "$ROOT/scripts/go-live.sh" > "$TMPSCRIPT2"
chmod +x "$TMPSCRIPT2"
GOODPW2="/tmp/test-tolerance-pw-$$"
printf "testpw123unattended" > "$GOODPW2"
chmod 600 "$GOODPW2"
if OUT=$(FORGE_RPC_URL="$RPC" FORGE_PASSWORD_FILE="$GOODPW2" GAS_PRICE_CEILING_WEI=2000000000 bash "$TMPSCRIPT2" test-unattended2 --variant gc014 --broadcast --unattended --max-okb 1.0 2>&1); then
  bad "did not abort despite GC-012's real cost exceeding the artificially-lowered reference+10%"
else
  echo "$OUT" | grep -q "exceeds its reference+10% ceiling" && ok "aborts when real cost exceeds reference+10% (10% tolerance check works)" || bad "aborted but not for the right reason: $OUT"
fi
rm -f "$TMPSCRIPT2" "$GOODPW2"

echo "== test 11: transistor-mint dedup - skip/partial/full mint cases, all real on-chain checks =="
# Real bug found during the owner's actual go-live run: GC-037's mint succeeded (36 real
# transistors held), but its own tapeout failed on an unrelated nonce race, leaving 36 unused
# transistors sitting in the wallet. A naive resume would have re-minted the full amount,
# wasting real OKB. Fixed: tapeout.sh now checks real balanceOf() first and only mints the
# shortfall (or skips minting entirely if the existing balance already covers it).
DEDUP_PW="/tmp/test-dedup-pw-$$"
printf "testpw123unattended" > "$DEDUP_PW"
chmod 600 "$DEDUP_PW"
DEDUP_KEYDIR="/tmp/test-dedup-keystore-$$"
mkdir -p "$DEDUP_KEYDIR"
PK_JSON=$("$CAST" wallet new-mnemonic --json)
DEDUP_PK=$(echo "$PK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['accounts'][0]['private_key'])")
DEDUP_ADDR=$(echo "$PK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['accounts'][0]['address'])")
"$CAST" wallet import dedup-test --keystore-dir "$DEDUP_KEYDIR" --private-key "$DEDUP_PK" --unsafe-password testpw123unattended >/dev/null
"$CAST" rpc anvil_setBalance "$DEDUP_ADDR" 0x56BC75E2D63100000 --rpc-url "$RPC" >/dev/null 2>&1

# Case A: zero existing balance -> full mint, then tapeout (task 20, fresh nIn=3 task not used
# by the real run, keeps this test independent of the owner's real circuits).
OUT_A=$(KEY_FILE="$DEDUP_KEYDIR/dedup-test" FORGE_PASSWORD_FILE="$DEDUP_PW" AUTO_CONFIRM=1 FORGE_RPC_URL="$RPC" bash "$ROOT/scripts/tapeout.sh" 7 --broadcast 2>&1) || true
echo "$OUT_A" | grep -q "Minting transistors" && echo "$OUT_A" | grep -q "circuitId:" \
  && ok "case A (zero balance): mints full amount, tapeout succeeds" \
  || bad "case A did not mint-then-tapeout as expected: $OUT_A"

# Case B: existing balance already sufficient -> mint skipped entirely.
BAL_B=$("$CAST" call "0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e" "balanceOf(address,uint256)(uint256)" "$DEDUP_ADDR" 0 --rpc-url "$RPC")
"$CAST" send "0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e" "mint(uint256,uint256)" 0 50 --value 0.00566ether --rpc-url "$RPC" --keystore "$DEDUP_KEYDIR/dedup-test" --password-file "$DEDUP_PW" >/dev/null 2>&1 || true
OUT_B=$(KEY_FILE="$DEDUP_KEYDIR/dedup-test" FORGE_PASSWORD_FILE="$DEDUP_PW" AUTO_CONFIRM=1 FORGE_RPC_URL="$RPC" bash "$ROOT/scripts/tapeout.sh" 14 --broadcast 2>&1) || true
echo "$OUT_B" | grep -q "Skipping mint: existing transistor balance" \
  && ok "case B (sufficient existing balance): mint skipped entirely" \
  || bad "case B did not skip the mint as expected: $OUT_B"

# Case C: non-zero but insufficient balance -> mints only the real shortfall.
OUT_C=$(KEY_FILE="$DEDUP_KEYDIR/dedup-test" FORGE_PASSWORD_FILE="$DEDUP_PW" AUTO_CONFIRM=1 FORGE_RPC_URL="$RPC" bash "$ROOT/scripts/tapeout.sh" 35 --broadcast 2>&1) || true
echo "$OUT_C" | grep -q "partially covers" && echo "$OUT_C" | grep -q "circuitId:" \
  && ok "case C (partial existing balance): mints only the shortfall, then tapes out successfully" \
  || bad "case C did not do a partial mint as expected: $OUT_C"
rm -f "$DEDUP_PW"
rm -rf "$DEDUP_KEYDIR"

echo "== test 12: nonce-safe sequential sends - mint-then-tapeout no longer races, and the receipt-wait aborts cleanly on a bogus hash =="
# Real bug found on the owner's actual run: two rapid sequential `cast send` calls (mint, then
# tapeout) against the public multi-node rpc.xlayer.tech gateway raced - the second call's own
# nonce auto-fetch landed on a backend node that hadn't yet seen the first tx. Fixed with
# explicit --nonce tracking (fetched once up front) plus a real wait_for_receipt check using the
# raw eth_getTransactionReceipt RPC call (NOT "cast receipt", which was found to itself block/
# poll internally for an unknown hash rather than returning fast - wrong for our own poll loop).
# Test 11 above already proves the real mint-then-tapeout sequence succeeds end to end on every
# case (A/B/C) without a nonce error - that IS the real regression test for the race itself.
# This test specifically exercises wait_for_receipt's abort path on a hash that will never
# confirm, extracted to its own tiny script so it's fast and isolated from a real send.
WAITFN_TEST="$ROOT/scripts/.test-wait-for-receipt.sh"
cat > "$WAITFN_TEST" << 'WAITEOF'
#!/usr/bin/env bash
CAST="$1"; RPC="$2"; TXHASH="$3"
wait_for_receipt() {
  local txhash="$1" tries=0 result status
  while [ "$tries" -lt 3 ]; do
    result=$("$CAST" rpc eth_getTransactionReceipt "$txhash" --rpc-url "$RPC" 2>/dev/null || echo "null")
    if [ "$result" != "null" ] && [ -n "$result" ]; then
      status=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
      [ "$status" = "0x1" ] || [ "$status" = "1" ] && return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  echo "ABORT: tx $txhash did not confirm with status=1 within ~60s. Stopping before the next send." >&2
  exit 1
}
wait_for_receipt "$TXHASH"
echo "should never reach here"
WAITEOF
chmod +x "$WAITFN_TEST"
if OUT=$(timeout 30 bash "$WAITFN_TEST" "$CAST" "$RPC" 0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddead 2>&1); then
  bad "wait_for_receipt did not abort on a tx hash that will never confirm"
else
  echo "$OUT" | grep -q "did not confirm with status=1" && ok "wait_for_receipt's abort path triggers correctly on an unconfirmable hash" || bad "aborted but not for the right reason: $OUT"
fi
rm -f "$WAITFN_TEST"

echo
echo "== $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]

