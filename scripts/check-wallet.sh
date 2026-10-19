#!/usr/bin/env bash
# Read-only. No key needed beyond a public address. Never prints/reads/logs a key.
# Usage: scripts/check-wallet.sh <address> [task...]
set -euo pipefail

ADDR="${1:?usage: check-wallet.sh <address> [task...]}"
shift || true
RPC="https://rpc.xlayer.tech"
FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
CAST="$FOUNDRY_BIN/cast"

BAL_WEI=$("$CAST" balance "$ADDR" --rpc-url "$RPC")
NONCE=$("$CAST" nonce "$ADDR" --rpc-url "$RPC")
BAL_OKB=$(python3 -c "print($BAL_WEI / 1e18)")

echo "address: $ADDR"
echo "balance: $BAL_OKB OKB ($BAL_WEI wei)"
echo "nonce:   $NONCE"

if [ "$#" -gt 0 ]; then
  echo
  echo "Real spend cap (config/cost.ts PHASE5_SPEND_CAP_OKB): 0.31596 OKB"
  echo "NOTE: FAB_TST transistor supply is currently EXHAUSTED on the real chain"
  echo "      (see docs/COSTS.md) - minting new transistors will revert 'supply cap'"
  echo "      regardless of how much OKB this address holds."
fi
