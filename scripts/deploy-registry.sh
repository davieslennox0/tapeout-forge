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

RPC="${FORGE_RPC_URL:-https://rpc.xlayer.tech}"  # override only for testing against a local fork
CHAIN_ID=196
FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
FORGE="$FOUNDRY_BIN/forge"
CAST="$FOUNDRY_BIN/cast"
BROADCAST=0
[ "${1:-}" = "--broadcast" ] && BROADCAST=1
# AUTO_CONFIRM skips the typed confirmations. It is honoured only when go-live.sh --unattended is the caller (it sets
# FORGE_GOLIVE_ORCHESTRATED=1 together with its own caps and checks). Exported by hand it would silently remove the prompts.
if [ "$BROADCAST" -eq 1 ] && [ "${AUTO_CONFIRM:-0}" = "1" ] && [ "${FORGE_GOLIVE_ORCHESTRATED:-}" != "1" ]; then
  echo "ABORT: AUTO_CONFIRM=1 is only honoured when go-live.sh --unattended calls this script. Unset it to get the typed confirmations." >&2
  exit 1
fi

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
# AUTO_CONFIRM mode (go-live.sh --unattended only): decrypt via a password FILE, never typed.
# This script never opens/reads/echoes the file - only cast ever touches its contents.
[ -n "${FORGE_PASSWORD_FILE:-}" ] && SIGNER_ARGS+=(--password-file "$FORGE_PASSWORD_FILE")

echo "== dry-run: estimating real deployment gas, read-only (no signer needed for this part) =="
# PHASE 9 fix: this Foundry version's `forge create` has no --dry-run flag at all (confirmed
# via `forge create --help` - it simply isn't a real option; the original script predates this
# and was never actually exercised against the real CLI outside a fork-impersonation context).
# `cast estimate --create <bytecode>` gives the same real number without needing to unlock any
# keystore - it's a genuine eth_estimateGas-backed read, not a guess.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/contracts"
BYTECODE=$("$FORGE" inspect src/ForgeRegistry.sol:ForgeRegistry bytecode)
GAS=$("$CAST" estimate --rpc-url "$RPC" --create "$BYTECODE" 2>&1) || true
if [[ "$GAS" =~ ^[0-9]+$ ]]; then
  GAS_PRICE_WEI=$("$CAST" gas-price --rpc-url "$RPC")
  COST_OKB=$(python3 -c "print(f'{$GAS * $GAS_PRICE_WEI / 1e18:.18f}'.rstrip('0').rstrip('.'))")
  echo "estimated gas: $GAS   real gas price: $GAS_PRICE_WEI wei   estimated cost: $COST_OKB OKB"
else
  echo "could not get a real gas estimate: $GAS"
fi

if [ "$BROADCAST" -eq 0 ]; then
  echo
  echo "Dry run only. Re-run with --broadcast to actually deploy (will ask for a typed confirmation first)."
  exit 0
fi

# Spend cap for the deployment itself (its gas was previously not capped at all). Default 0.01 OKB, which is about 1000x the
# real cost (0.0000093 OKB measured); override with MAX_OKB_OVERRIDE.
DEPLOY_CAP_OKB="${MAX_OKB_OVERRIDE:-0.01}"
case "$DEPLOY_CAP_OKB" in *[!0-9.]*|""|.|*.*.*) echo "ABORT: MAX_OKB_OVERRIDE must be a plain decimal number, got '$DEPLOY_CAP_OKB'." >&2; exit 1 ;; esac
case "${COST_OKB:-}" in ""|*[!0-9.e-]*) echo "ABORT: no numeric gas estimate for the deployment; refusing to broadcast without a cost." >&2; exit 1 ;; esac
if [ "$(python3 -c "print(1 if $COST_OKB > $DEPLOY_CAP_OKB else 0)")" = "1" ]; then
  echo "ABORT: estimated deployment cost $COST_OKB OKB exceeds the cap $DEPLOY_CAP_OKB OKB (checked before anything is sent)." >&2
  exit 1
fi
echo
if [ "${AUTO_CONFIRM:-0}" = "1" ]; then
  echo "=== AUTO_CONFIRM (unattended) - verifying programmatically instead of a typed prompt ==="
  REAL_CHAIN_ID=$("$CAST" chain-id --rpc-url "$RPC")
  if [ "$REAL_CHAIN_ID" != "$CHAIN_ID" ]; then
    echo "ABORT: live chain id is $REAL_CHAIN_ID, expected $CHAIN_ID." >&2
    exit 1
  fi
  echo "  verified: live chain id == $CHAIN_ID"
else
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
fi

echo "Broadcasting for real..."
"$FORGE" create src/ForgeRegistry.sol:ForgeRegistry --rpc-url "$RPC" "${SIGNER_ARGS[@]}" --broadcast
echo
echo "If the deployment above succeeded (status 1), copy the deployed address into"
echo "config/chains.ts yourself - this script does not do it automatically, to avoid"
echo "recording an address before you've independently confirmed the receipt succeeded."
