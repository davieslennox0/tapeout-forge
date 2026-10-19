#!/usr/bin/env bash
# Deploy ForgeRegistry (ownerless, no constructor args). DRY-RUN by default: estimates gas and
# OKB cost, never sends. Broadcasting requires --broadcast AND a typed confirmation.
#
# Key handling: NEVER pass --private-key on this command line. Set exactly one of:
#   KEYSTORE_ACCOUNT  - a cast/foundry keystore account name (cast wallet import'd earlier)
#   KEY_FILE          - a path to a keystore JSON file; cast prompts for its password itself
# This script never reads, echoes, or logs either the key file's content or a private key.
#
# Usage: scripts/deploy-registry.sh [--broadcast]
set -euo pipefail

RPC="https://rpc.xlayer.tech"
CHAIN_ID=196
FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
FORGE="$FOUNDRY_BIN/forge"
CAST="$FOUNDRY_BIN/cast"
BROADCAST=0
[ "${1:-}" = "--broadcast" ] && BROADCAST=1

if [ -z "${KEYSTORE_ACCOUNT:-}" ] && [ -z "${KEY_FILE:-}" ]; then
  echo "Set KEYSTORE_ACCOUNT or KEY_FILE (never a raw private key on this command line)." >&2
  exit 1
fi
SIGNER_ARGS=()
if [ -n "${KEYSTORE_ACCOUNT:-}" ]; then
  SIGNER_ARGS=(--account "$KEYSTORE_ACCOUNT")
else
  SIGNER_ARGS=(--keystore "$KEY_FILE")
fi

echo "== dry-run: estimating deployment gas on a real fork of chain $CHAIN_ID =="
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/contracts"
DEPLOY_OUT=$("$FORGE" create src/ForgeRegistry.sol:ForgeRegistry --rpc-url "$RPC" "${SIGNER_ARGS[@]}" --dry-run 2>&1) || true
echo "$DEPLOY_OUT"
GAS=$(echo "$DEPLOY_OUT" | grep -oE 'gas (used|estimate)[: ]+[0-9]+' | grep -oE '[0-9]+' | head -1 || echo "")
if [ -n "$GAS" ]; then
  GAS_PRICE_WEI=$("$CAST" gas-price --rpc-url "$RPC")
  COST_OKB=$(python3 -c "print($GAS * $GAS_PRICE_WEI / 1e18)")
  echo "estimated gas: $GAS   real gas price: $GAS_PRICE_WEI wei   estimated cost: $COST_OKB OKB"
else
  echo "could not parse a gas estimate from forge's output above - read it manually before broadcasting."
fi

if [ "$BROADCAST" -eq 0 ]; then
  echo
  echo "Dry run only. Re-run with --broadcast to actually deploy (will ask for a typed confirmation first)."
  exit 0
fi

echo
echo "=== BROADCAST CONFIRMATION REQUIRED ==="
echo "You are about to deploy ForgeRegistry for real on chain $CHAIN_ID."
echo "Type the exact chain id, then press enter:"
read -r TYPED_CHAIN
if [ "$TYPED_CHAIN" != "$CHAIN_ID" ]; then
  echo "Chain id did not match. Aborting." >&2
  exit 1
fi
echo "Type the exact estimated cost shown above (as printed, e.g. 0.0123456), then press enter:"
read -r TYPED_COST
if [ "$TYPED_COST" != "$COST_OKB" ]; then
  echo "Cost confirmation did not match exactly. Aborting." >&2
  exit 1
fi

echo "Broadcasting for real..."
"$FORGE" create src/ForgeRegistry.sol:ForgeRegistry --rpc-url "$RPC" "${SIGNER_ARGS[@]}" --broadcast
echo
echo "If the deployment above succeeded (status 1), copy the deployed address into"
echo "config/chains.ts yourself - this script does not do it automatically, to avoid"
echo "recording an address before you've independently confirmed the receipt succeeded."
