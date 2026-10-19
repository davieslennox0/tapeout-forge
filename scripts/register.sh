#!/usr/bin/env bash
# Register a REAL already-taped-out circuit in ForgeRegistry. Requires the real circuit id
# from a prior real tapeout (confirmed manually by the owner, per tapeout.sh's own output -
# this project never confirmed FAB_TST's exact return-value/event encoding, so circuit ids are
# never auto-parsed/guessed here either).
#
# For nIn <= 6: fetches the REAL expected outputs via real eval() calls on the deployed circuit
# and lets the registry verify on-chain itself. For nIn > 6: attestation-only path (empty
# expectedOutputs), per contracts/src/ForgeRegistry.sol's own design (BUILD.md 4.3).
#
# DRY-RUN by default. --broadcast requires a typed confirmation. Same key-handling rules as
# the other scripts (KEYSTORE_ACCOUNT or KEY_FILE only, never --private-key here).
#
# Usage: scripts/register.sh <task-id> <real-circuit-id> [--broadcast]
set -euo pipefail

TASK="${1:?usage: register.sh <task-id> <real-circuit-id> [--broadcast]}"
CIRCUIT_ID="${2:?usage: register.sh <task-id> <real-circuit-id> [--broadcast]}"
shift 2 || true
BROADCAST=0
[ "${1:-}" = "--broadcast" ] && BROADCAST=1

RPC="https://rpc.xlayer.tech"
CHAIN_ID=196
PROCESSOR="0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6"  # FAB_TST, CONFIRMED
REGISTRY="${FORGE_REGISTRY_ADDRESS:-}"
FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
CAST="$FOUNDRY_BIN/cast"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "$REGISTRY" ]; then
  echo "Set FORGE_REGISTRY_ADDRESS (from config/chains.ts, after scripts/deploy-registry.sh)." >&2
  exit 1
fi

read -r NIN NOUT GATES DEPTH << EOF
$(python3 -c "
import json
d = json.load(open('$ROOT/apps/web/src/data/gallery.full.json'))
row = next(r for r in d if r['id'] == $TASK)
print(row['nIn'], row['nOut'], row['totalGates'], row.get('depth', 0))
")
EOF

SPEC_HASH=$("$CAST" keccak "GC-$(printf '%03d' "$TASK")")
echo "specHash: $SPEC_HASH   nIn=$NIN nOut=$NOUT gates=$GATES depth=$DEPTH"

if [ "$NIN" -le 6 ]; then
  echo "nIn<=6: fetching REAL expected outputs via eval() on the deployed circuit..."
  WIDTH=$((1 << NIN))
  OUTPUTS=()
  for ((i=0; i<WIDTH; i++)); do
    HEXI=$(printf '0x%02x' "$i")
    OUT=$("$CAST" call "$PROCESSOR" "eval(uint256,bytes)(bytes)" "$CIRCUIT_ID" "$HEXI" --rpc-url "$RPC")
    OUTPUTS+=("$OUT")
  done
  EXPECTED_ARG="[$(IFS=,; echo "${OUTPUTS[*]}")]"
  echo "fetched $WIDTH real output rows."
else
  echo "nIn>6: attestation-only path, expectedOutputs=[] (not independently checked on-chain, per BUILD.md 4.3)."
  EXPECTED_ARG="[]"
fi

CALLDATA=$("$CAST" calldata "submit(bytes32,address,uint256,uint8,uint8,uint32,uint32,bytes[],bytes32)" \
  "$SPEC_HASH" "$PROCESSOR" "$CIRCUIT_ID" "$NIN" "$NOUT" "$GATES" "$DEPTH" "$EXPECTED_ARG" "0x0000000000000000000000000000000000000000000000000000000000000000")
echo "calldata: $CALLDATA"

if [ "$BROADCAST" -eq 0 ]; then
  echo
  echo "Dry run only. Re-run with --broadcast to actually submit (will ask for a typed confirmation first)."
  exit 0
fi

if [ -z "${KEYSTORE_ACCOUNT:-}" ] && [ -z "${KEY_FILE:-}" ]; then
  echo "Set KEYSTORE_ACCOUNT or KEY_FILE (never a raw private key on this command line)." >&2
  exit 1
fi
SIGNER_ARGS=()
[ -n "${KEYSTORE_ACCOUNT:-}" ] && SIGNER_ARGS=(--account "$KEYSTORE_ACCOUNT") || SIGNER_ARGS=(--keystore "$KEY_FILE")

echo
echo "=== BROADCAST CONFIRMATION REQUIRED ==="
echo "Type the exact registry address ($REGISTRY), then press enter:"
read -r TYPED_ADDR
[ "$TYPED_ADDR" = "$REGISTRY" ] || { echo "Address did not match. Aborting." >&2; exit 1; }
echo "Type the exact chain id ($CHAIN_ID), then press enter:"
read -r TYPED_CHAIN
[ "$TYPED_CHAIN" = "$CHAIN_ID" ] || { echo "Chain id did not match. Aborting." >&2; exit 1; }
echo "This submission costs only real gas, no OKB value is sent. Type CONFIRM to proceed:"
read -r TYPED_OK
[ "$TYPED_OK" = "CONFIRM" ] || { echo "Not confirmed. Aborting." >&2; exit 1; }

"$CAST" send "$REGISTRY" "submit(bytes32,address,uint256,uint8,uint8,uint32,uint32,bytes[],bytes32)" \
  "$SPEC_HASH" "$PROCESSOR" "$CIRCUIT_ID" "$NIN" "$NOUT" "$GATES" "$DEPTH" "$EXPECTED_ARG" "0x0000000000000000000000000000000000000000000000000000000000000000" \
  --rpc-url "$RPC" "${SIGNER_ARGS[@]}"
