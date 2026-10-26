#!/usr/bin/env bash
# Tape out one of this project's own real netlists (by gallery.full.json id) against OrderGuard.
# PHASE 7: retargeted from FAB_TST (transistor supply exhausted, no acquisition route - see
# docs/ACQUIRE-AND-CLAIM.md) to OrderGuard, which has real transistor-supply headroom.
# Mints transistors first if the caller's balance is short (and only the real shortfall, not
# blindly the full amount - a real run found 36 transistors already sitting unused after a
# prior partial failure; minting again would have wasted real OKB).
# DRY-RUN by default (prints calldata + real cost, never sends). --broadcast requires a typed
# confirmation of the exact total OKB, the processor address, and chain id 196, and refuses if
# the computed cost exceeds config/cost.ts's spend cap.
#
# Key handling: KEYSTORE_ACCOUNT or KEY_FILE only, never --private-key on this command line,
# never read/echoed/logged by this script.
#
# NONCE FIX (real bug found on a real run): two sequential `cast send` calls (mint, then
# tapeout) against the public multi-node rpc.xlayer.tech gateway can race - the second call's
# own "next nonce" auto-fetch can land on a backend node that hasn't yet seen the first tx,
# even though the first `cast send` already blocked until its own receipt confirmed (status=1
# was returned). Fixed by fetching the nonce ONCE up front and passing --nonce explicitly to
# both sends, so neither depends on any node's own nonce bookkeeping being in sync.
#
# Usage: scripts/tapeout.sh <task-id> [--broadcast]
set -euo pipefail

TASK="${1:?usage: tapeout.sh <task-id> [--broadcast]}"
shift || true
BROADCAST=0
[ "${1:-}" = "--broadcast" ] && BROADCAST=1

RPC="${FORGE_RPC_URL:-https://rpc.xlayer.tech}"  # override only for testing against a local fork
CHAIN_ID=196
# Must match config/chains.ts's ACTIVE_PROCESSOR / ACTIVE_PROCESSOR_NAME / ACTIVE_TRANSISTORS.
PROCESSOR="0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355"      # OrderGuard (PHASE 7 default)
PROCESSOR_NAME_EXPECTED="OrderGuard"                          # real on-chain name(), verified live
TRANSISTORS="0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e"      # OrderGuard's own transistor contract
TAPEOUT_FEE_WEI=1300000000000000
MINT_PRICE_WEI=100000000000000
PROTOCOL_FEE_WEI=660000000000000
SPEND_CAP_OKB=0.05462  # PHASE 8: real OrderGuard-priced cap, was stale FAB_TST-era 0.31596
# go-live.sh --unattended --max-okb passes a stricter override here too, so a single step can
# never broadcast past it even before the orchestrator's own cumulative check runs.
[ -n "${MAX_OKB_OVERRIDE:-}" ] && SPEND_CAP_OKB=$(python3 -c "print(min($SPEND_CAP_OKB, $MAX_OKB_OVERRIDE))")

FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
CAST="$FOUNDRY_BIN/cast"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-tx.sh
. "$ROOT/scripts/lib-tx.sh"
# Event topics used to find a tx on-chain when the RPC returns a null/errored reply (see lib-tx.sh).
TRANSFER_SINGLE_T0="0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62"   # transistor mint/burn
TAPEOUT_EVENT_T0="0xc11215e417669c143c8a07aeb778034c0a0a85ebdf305d64a629b19a7a9ce031"       # processor tape-out: topics[1]=circuitId, topics[2]=sender

# Poll a real receipt until status=1, or abort after a timeout. Used as a defensive check that
# a send genuinely confirmed before relying on its effects - not the primary nonce fix (that's
# the explicit --nonce assignment below), but a real guard against trusting an unconfirmed tx.
wait_for_receipt() {
  # Uses the raw eth_getTransactionReceipt RPC call, not "cast receipt", because cast's own
  # receipt command internally polls/blocks waiting for a tx to appear rather than returning
  # immediately for an unknown hash - wrong behavior for OUR polling loop, which wants a fast,
  # non-blocking check on each try (confirmed directly: the raw RPC call returns "null"
  # immediately for a bogus hash, in well under a second).
  local txhash="$1" tries=0 result status
  while [ "$tries" -lt 20 ]; do
    result=$("$CAST" rpc eth_getTransactionReceipt "$txhash" --rpc-url "$RPC" 2>/dev/null || echo "null")
    if [ "$result" != "null" ] && [ -n "$result" ]; then
      status=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
      if [ "$status" = "0x1" ] || [ "$status" = "1" ]; then
        return 0
      fi
    fi
    tries=$((tries + 1))
    sleep 3
  done
  echo "ABORT: tx $txhash did not confirm with status=1 within ~60s. Stopping before the next send." >&2
  exit 1
}

echo "== safety guard: confirming processor identity on-chain before anything else =="
REAL_CODE=$("$CAST" code "$PROCESSOR" --rpc-url "$RPC")
if [ "$REAL_CODE" = "0x" ] || [ -z "$REAL_CODE" ]; then
  echo "ABORT: eth_getCode on $PROCESSOR is empty - this address has no contract. Refusing to proceed." >&2
  exit 1
fi
REAL_NAME=$("$CAST" call "$PROCESSOR" "name()(string)" --rpc-url "$RPC")
if [ "$REAL_NAME" != "\"$PROCESSOR_NAME_EXPECTED\"" ] && [ "$REAL_NAME" != "$PROCESSOR_NAME_EXPECTED" ]; then
  echo "ABORT: processor name() returned '$REAL_NAME', expected '$PROCESSOR_NAME_EXPECTED'." >&2
  echo "The configured processor address may be wrong. Refusing to proceed." >&2
  exit 1
fi
echo "ok: $PROCESSOR has code and name() == $PROCESSOR_NAME_EXPECTED"

NETLIST_HEX=$(python3 -c "
import json
d = json.load(open('$ROOT/apps/web/src/data/gallery.full.json'))
row = next(r for r in d if r['id'] == $TASK)
print(row['netlistHex'])
print(row['nIn'])
print(row['nOut'])
print(row['totalGates'])
" )
NL=$(echo "$NETLIST_HEX" | sed -n 1p)
NIN=$(echo "$NETLIST_HEX" | sed -n 2p)
NOUT=$(echo "$NETLIST_HEX" | sed -n 3p)
GATES=$(echo "$NETLIST_HEX" | sed -n 4p)

MINT_COST_WEI=$(python3 -c "print($GATES * $MINT_PRICE_WEI + $PROTOCOL_FEE_WEI)")
TOTAL_WEI=$(python3 -c "print($MINT_COST_WEI + $TAPEOUT_FEE_WEI)")
TOTAL_OKB=$(python3 -c "print($TOTAL_WEI / 1e18)")

echo
echo "task GC-$(printf '%03d' "$TASK"): nIn=$NIN nOut=$NOUT gates=$GATES"
echo "real fee math (worst case, assumes zero existing transistor balance): mint=$MINT_COST_WEI wei + tapeout=$TAPEOUT_FEE_WEI wei => total=$TOTAL_OKB OKB"
echo "calldata (tapeout): $("$CAST" calldata "tapeout(bytes,uint32,uint32)" "$NL" "$NIN" "$NOUT")"

if [ "$BROADCAST" -eq 0 ]; then
  echo
  echo "Dry run only. Re-run with --broadcast to actually mint+tapeout (will ask for a typed confirmation first)."
  exit 0
fi

if [ -z "${KEYSTORE_ACCOUNT:-}" ] && [ -z "${KEY_FILE:-}" ]; then
  echo "Set KEYSTORE_ACCOUNT or KEY_FILE (never a raw private key on this command line)." >&2
  exit 1
fi
SIGNER_ARGS=()
[ -n "${KEYSTORE_ACCOUNT:-}" ] && SIGNER_ARGS=(--account "$KEYSTORE_ACCOUNT") || SIGNER_ARGS=(--keystore "$KEY_FILE")
[ -n "${FORGE_PASSWORD_FILE:-}" ] && SIGNER_ARGS+=(--password-file "$FORGE_PASSWORD_FILE")

CAP_CHECK=$(python3 -c "print(1 if $TOTAL_OKB > $SPEND_CAP_OKB else 0)")
if [ "$CAP_CHECK" = "1" ]; then
  echo "ABORT: real cost $TOTAL_OKB OKB exceeds the configured spend cap $SPEND_CAP_OKB OKB." >&2
  exit 1
fi

echo
if [ "${AUTO_CONFIRM:-0}" = "1" ]; then
  echo "=== AUTO_CONFIRM (unattended) - verifying programmatically instead of a typed prompt ==="
  REAL_CHAIN_ID=$("$CAST" chain-id --rpc-url "$RPC")
  [ "$REAL_CHAIN_ID" = "$CHAIN_ID" ] || { echo "ABORT: live chain id is $REAL_CHAIN_ID, expected $CHAIN_ID." >&2; exit 1; }
  echo "  verified: live chain id == $CHAIN_ID, processor identity already confirmed above, cap already checked by the caller"
else
  echo "=== BROADCAST CONFIRMATION REQUIRED ==="
  echo "Type the exact total OKB shown above ($TOTAL_OKB), then press enter:"
  read -r TYPED_COST
  [ "$TYPED_COST" = "$TOTAL_OKB" ] || { echo "Cost did not match. Aborting." >&2; exit 1; }
  echo "Type the exact processor address ($PROCESSOR), then press enter:"
  read -r TYPED_ADDR
  [ "$TYPED_ADDR" = "$PROCESSOR" ] || { echo "Address did not match. Aborting." >&2; exit 1; }
  echo "Type the exact chain id ($CHAIN_ID), then press enter:"
  read -r TYPED_CHAIN
  [ "$TYPED_CHAIN" = "$CHAIN_ID" ] || { echo "Chain id did not match. Aborting." >&2; exit 1; }
fi

# Resolve the real deployer address (needed for the balance check and explicit nonce tracking
# below). Degrades gracefully if it can't be resolved non-interactively: in that case we skip
# the existing-balance optimization (mint the full worst-case amount, same as before this fix)
# and fall back to each send's own auto-nonce-fetch (same race risk as before this fix, but
# only in that degraded case, which real unattended runs - the ones with real money at stake -
# never hit, since FORGE_PASSWORD_FILE makes this resolve non-interactively).
DEPLOYER=""
DEPLOYER=$("$CAST" wallet address "${SIGNER_ARGS[@]}" 2>/dev/null) || DEPLOYER=""

MINT_NEEDED="$GATES"
EXISTING_BAL=0
if [ -n "$DEPLOYER" ]; then
  EXISTING_BAL=$("$CAST" call "$TRANSISTORS" "balanceOf(address,uint256)(uint256)" "$DEPLOYER" 0 --rpc-url "$RPC" 2>/dev/null | grep -oE '^[0-9]+' || echo 0)
  MINT_NEEDED=$(python3 -c "print(max(0, $GATES - $EXISTING_BAL))")
else
  echo "  (could not resolve deployer address non-interactively - skipping existing-balance check, minting the full worst-case amount)"
fi

FROM_BLOCK=$("$CAST" block-number --rpc-url "$RPC" 2>/dev/null || echo 0)
FROM_BLOCK=$(( FROM_BLOCK > 5 ? FROM_BLOCK - 5 : 0 ))   # small margin: never start the event scan after our own send
START_NONCE=""
[ -n "$DEPLOYER" ] && START_NONCE=$("$CAST" nonce "$DEPLOYER" --rpc-url "$RPC" 2>/dev/null || echo "")

NEXT_NONCE_ARGS=()
if [ "$MINT_NEEDED" = "0" ]; then
  echo "Skipping mint: existing transistor balance $EXISTING_BAL already covers the $GATES gates needed."
  [ -n "$START_NONCE" ] && NEXT_NONCE_ARGS=(--nonce "$START_NONCE")
else
  if [ "$EXISTING_BAL" != "0" ]; then
    echo "Existing transistor balance $EXISTING_BAL partially covers $GATES gates needed - minting only the shortfall: $MINT_NEEDED."
  fi
  MINT_COST_WEI_ACTUAL=$(python3 -c "print($MINT_NEEDED * $MINT_PRICE_WEI + $PROTOCOL_FEE_WEI)")
  MINT_NONCE_ARGS=()
  [ -n "$START_NONCE" ] && MINT_NONCE_ARGS=(--nonce "$START_NONCE")
  echo "Minting transistors..."
  SENDER_TOPIC="0x000000000000000000000000$(echo "${DEPLOYER#0x}" | tr 'A-F' 'a-f')"
  MINT_FILTERS=("3=$SENDER_TOPIC" "2=0x0000000000000000000000000000000000000000000000000000000000000000")
  [ -z "$DEPLOYER" ] && MINT_FILTERS=("9=none")   # degraded mode: no sender to match, so never "recover" someone else's event
  MINT_OUT=$(send_and_confirm mint "$DEPLOYER" "$START_NONCE" "$TRANSISTORS" "$TRANSFER_SINGLE_T0" "$FROM_BLOCK" "${MINT_FILTERS[@]}" -- \
    "$TRANSISTORS" "mint(uint256,uint256)" 0 "$MINT_NEEDED" --value "$MINT_COST_WEI_ACTUAL" "${SIGNER_ARGS[@]}" "${MINT_NONCE_ARGS[@]}") \
    || { echo "ABORT: mint did not confirm. Stopping before tape-out." >&2; exit 1; }
  echo "mint confirmed: ${MINT_OUT%% *}"
  if [ -n "$START_NONCE" ]; then
    NEXT_NONCE_ARGS=(--nonce "$((START_NONCE + 1))")
  fi
fi

echo "Taping out..."
SENDER_TOPIC="0x000000000000000000000000$(echo "${DEPLOYER#0x}" | tr 'A-F' 'a-f')"
TO_FILTERS=("2=$SENDER_TOPIC")
[ -z "$DEPLOYER" ] && TO_FILTERS=("9=none")
TO_OUT=$(send_and_confirm tapeout "$DEPLOYER" "${NEXT_NONCE_ARGS[1]:-$START_NONCE}" "$PROCESSOR" "$TAPEOUT_EVENT_T0" "$FROM_BLOCK" "${TO_FILTERS[@]}" -- \
  "$PROCESSOR" "tapeout(bytes,uint32,uint32)" "$NL" "$NIN" "$NOUT" --value "$TAPEOUT_FEE_WEI" "${SIGNER_ARGS[@]}" "${NEXT_NONCE_ARGS[@]}") \
  || { echo "ABORT: tape-out did not confirm (see the message above for whether a retry is safe)." >&2; exit 1; }
TXHASH="${TO_OUT%% *}"
RECOVERED_TOPIC1=""
[ "$TO_OUT" != "$TXHASH" ] && RECOVERED_TOPIC1="${TO_OUT#* }"
echo "tape-out tx: $TXHASH"

echo
echo "Parsing circuit id from the real receipt (event topic0 0xc11215e4..., confirmed live on a"
echo "fork test: topics[1]=circuitId, topics[2]=sender, data word[0]=gates):"
CIRCUIT_ID=""
for _try in 1 2 3 4 5 6 7 8 9 10; do
  RECEIPT_JSON=$(tx_receipt_json "$TXHASH" || true)
  if [ -n "$RECEIPT_JSON" ]; then
    CIRCUIT_ID=$(echo "$RECEIPT_JSON" | python3 -c "
import json, sys
r = json.load(sys.stdin)
for log in r['logs']:
    if log['topics'][0].lower().startswith('0xc11215e4'):
        print(int(log['topics'][1], 16))
        break
" )
    break
  fi
  sleep "${TX_POLL_SLEEP:-2}"
done
# Receipt reads kept returning null but the tx was found by its event: that event carries the circuit id.
if [ -z "$CIRCUIT_ID" ] && [ -n "$RECOVERED_TOPIC1" ]; then CIRCUIT_ID=$((RECOVERED_TOPIC1)); fi
if [ -z "$CIRCUIT_ID" ]; then
  echo "Could not find the expected event in this receipt - printing it raw instead, read it yourself:"
  echo "$RECEIPT_JSON"
else
  echo "circuitId: $CIRCUIT_ID"
  echo "- $(date -u +%Y-%m-%d): processor=$PROCESSOR circuitId=$CIRCUIT_ID tx=$TXHASH" >> "$ROOT/docs/TAPEOUTS.md"
  echo "appended to docs/TAPEOUTS.md"
fi

