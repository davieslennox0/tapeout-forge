#!/usr/bin/env bash
# Read-only pre-flight checks before any real broadcast. No key needed - takes a public
# address only. Prints PASS/FAIL per item, exits non-zero on any FAIL.
# Usage: scripts/preflight.sh <wallet-address> [--variant gc039|gc014]
set -euo pipefail

ADDR="${1:?usage: preflight.sh <wallet-address> [--variant gc039|gc014]}"
shift || true
VARIANT="gc039"
if [ "${1:-}" = "--variant" ]; then VARIANT="${2:-gc039}"; fi

RPC="https://rpc.xlayer.tech"
CHAIN_ID=196
PROCESSOR="0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355"      # OrderGuard (PHASE 7 default)
PROCESSOR_NAME_EXPECTED="OrderGuard"
TRANSISTORS="0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e"
TRANSISTORS_NEEDED_GC039=349
TRANSISTORS_NEEDED_GC014=242
FUNDING_GC039_OKB=0.045517
FUNDING_GC014_OKB=0.034285
# Sanity ceiling on gas price (PHASE 8: real price observed 2026-10-19 was 20,000,001 wei/gas;
# 10x that is already a very generous ceiling for an L2 that is normally this cheap).
GAS_PRICE_CEILING_WEI=200000010

FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
CAST="$FOUNDRY_BIN/cast"

# cast prints large uints as "N [sci]" (e.g. "10000 [1e4]") - strip the bracketed part.
num() { awk '{print $1}'; }

FAIL=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }

echo "== Pre-flight for $ADDR (variant: $VARIANT) =="

REAL_CHAIN_ID=$("$CAST" chain-id --rpc-url "$RPC")
if [ "$REAL_CHAIN_ID" = "$CHAIN_ID" ]; then pass "chain id == $CHAIN_ID"; else fail "chain id == $REAL_CHAIN_ID, expected $CHAIN_ID"; fi

REAL_CODE=$("$CAST" code "$PROCESSOR" --rpc-url "$RPC")
if [ "$REAL_CODE" != "0x" ] && [ -n "$REAL_CODE" ]; then
  pass "ACTIVE_PROCESSOR ($PROCESSOR) has code"
  REAL_NAME=$("$CAST" call "$PROCESSOR" "name()(string)" --rpc-url "$RPC")
  CLEAN_NAME=$(echo "$REAL_NAME" | tr -d '"')
  if [ "$CLEAN_NAME" = "$PROCESSOR_NAME_EXPECTED" ]; then
    pass "name() == $PROCESSOR_NAME_EXPECTED (read live, not assumed)"
  else
    fail "name() == '$CLEAN_NAME', expected '$PROCESSOR_NAME_EXPECTED' - configured address may be wrong"
  fi
else
  fail "ACTIVE_PROCESSOR has no code at $PROCESSOR"
fi

SUPPLY_CAP=$("$CAST" call "$TRANSISTORS" "supplyCap()(uint256)" --rpc-url "$RPC" | num)
MINTED=$("$CAST" call "$TRANSISTORS" "minted()(uint256)" --rpc-url "$RPC" | num)
HEADROOM=$((SUPPLY_CAP - MINTED))
NEEDED=$TRANSISTORS_NEEDED_GC039
[ "$VARIANT" = "gc014" ] && NEEDED=$TRANSISTORS_NEEDED_GC014
if [ "$HEADROOM" -ge "$NEEDED" ]; then
  pass "transistor headroom $HEADROOM >= $NEEDED needed (variant $VARIANT)"
else
  fail "transistor headroom $HEADROOM < $NEEDED needed (variant $VARIANT)"
fi

BAL_WEI=$("$CAST" balance "$ADDR" --rpc-url "$RPC")
NEEDED_OKB=$FUNDING_GC039_OKB
[ "$VARIANT" = "gc014" ] && NEEDED_OKB=$FUNDING_GC014_OKB
NEEDED_WEI=$(python3 -c "print(int($NEEDED_OKB * 1e18))")
if [ "$BAL_WEI" -ge "$NEEDED_WEI" ]; then
  pass "wallet balance $(python3 -c "print($BAL_WEI/1e18)") OKB >= $NEEDED_OKB OKB needed"
else
  fail "wallet balance $(python3 -c "print($BAL_WEI/1e18)") OKB < $NEEDED_OKB OKB needed"
fi

GAS_PRICE=$("$CAST" gas-price --rpc-url "$RPC" | num)
if [ "$GAS_PRICE" -le "$GAS_PRICE_CEILING_WEI" ]; then
  pass "gas price $GAS_PRICE wei/gas <= ceiling $GAS_PRICE_CEILING_WEI wei/gas"
else
  fail "gas price $GAS_PRICE wei/gas > ceiling $GAS_PRICE_CEILING_WEI wei/gas - unusually high, re-check before proceeding"
fi

if [ -n "${FORGE_REGISTRY_ADDRESS:-}" ]; then
  REG_CODE=$("$CAST" code "$FORGE_REGISTRY_ADDRESS" --rpc-url "$RPC")
  if [ "$REG_CODE" != "0x" ] && [ -n "$REG_CODE" ]; then
    pass "FORGE_REGISTRY_ADDRESS ($FORGE_REGISTRY_ADDRESS) has code"
  else
    fail "FORGE_REGISTRY_ADDRESS has no code at $FORGE_REGISTRY_ADDRESS"
  fi
else
  echo "SKIP: FORGE_REGISTRY_ADDRESS not set yet (expected before deploy-registry.sh has run)"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "ALL CHECKS PASS"
else
  echo "ONE OR MORE CHECKS FAILED - do not proceed"
fi
exit "$FAIL"
