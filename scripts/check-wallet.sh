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
  echo "PHASE 7: go-live targets OrderGuard (0x57F3...a355), not FAB_TST."
  echo "FAB_TST's transistor supply is exhausted with no acquisition route found"
  echo "(docs/ACQUIRE-AND-CLAIM.md) - that path is set aside, not used by default."
  echo "OrderGuard's own transistor contract has real headroom (see docs/COSTS.md)."
fi
