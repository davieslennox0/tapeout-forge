#!/usr/bin/env bash
# Tape out one of this project's own real netlists (by gallery.full.json id) against OrderGuard.
# PHASE 7: retargeted from FAB_TST (transistor supply exhausted, no acquisition route - see
# docs/ACQUIRE-AND-CLAIM.md) to OrderGuard, which has real transistor-supply headroom.
# Mints transistors first if the caller's balance is short.
# DRY-RUN by default (prints calldata + real cost, never sends). --broadcast requires a typed
# confirmation of the exact total OKB, the processor address, and chain id 196, and refuses if
# the computed cost exceeds config/cost.ts's spend cap.
#
# Key handling: KEYSTORE_ACCOUNT or KEY_FILE only, never --private-key on this command line,
# never read/echoed/logged by this script.
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
echo "real fee math: mint=$MINT_COST_WEI wei + tapeout=$TAPEOUT_FEE_WEI wei => total=$TOTAL_OKB OKB"
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

echo "Minting transistors..."
MINT_TX=$("$CAST" send "$TRANSISTORS" "mint(uint256,uint256)" 0 "$GATES" --value "$MINT_COST_WEI" --rpc-url "$RPC" "${SIGNER_ARGS[@]}" --json)
echo "$MINT_TX"

echo "Taping out..."
TO_TX=$("$CAST" send "$PROCESSOR" "tapeout(bytes,uint32,uint32)" "$NL" "$NIN" "$NOUT" --value "$TAPEOUT_FEE_WEI" --rpc-url "$RPC" "${SIGNER_ARGS[@]}" --json)
echo "$TO_TX"
TXHASH=$(echo "$TO_TX" | python3 -c "import json,sys; print(json.load(sys.stdin)['transactionHash'])")

echo
echo "Parsing circuit id from the real receipt (event topic0 0xc11215e4..., confirmed live on a"
echo "fork test: topics[1]=circuitId, topics[2]=sender, data word[0]=gates):"
RECEIPT_JSON=$("$CAST" receipt "$TXHASH" --rpc-url "$RPC" --json)
CIRCUIT_ID=$(echo "$RECEIPT_JSON" | python3 -c "
import json, sys
r = json.load(sys.stdin)
for log in r['logs']:
    if log['topics'][0].lower().startswith('0xc11215e4'):
        print(int(log['topics'][1], 16))
        break
" )
if [ -z "$CIRCUIT_ID" ]; then
  echo "Could not find the expected event in this receipt - printing it raw instead, read it yourself:"
  echo "$RECEIPT_JSON"
else
  echo "circuitId: $CIRCUIT_ID"
  echo "- $(date -u +%Y-%m-%d): processor=$PROCESSOR circuitId=$CIRCUIT_ID tx=$TXHASH" >> "$ROOT/docs/TAPEOUTS.md"
  echo "appended to docs/TAPEOUTS.md"
fi
