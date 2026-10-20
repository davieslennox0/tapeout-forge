#!/usr/bin/env bash
# PHASE 9 (+ unattended mode): ordered go-live orchestrator. DRY-RUN by default (no --broadcast
# => nothing is ever sent). Never reads/prints/logs a key - uses KEYSTORE_ACCOUNT (set from
# <account-name>) internally via the existing per-step scripts, which already enforce
# keystore-only signing. Resumable: a circuit is skipped only if docs/TAPEOUTS.md AND live
# on-chain registry state both confirm it's already done - never the file alone. Aborts the
# WHOLE run (no partial continuation to the next circuit) if cumulative spend would exceed the
# cap, any step fails, or verify-live.sh reports a mismatch. Never auto-retries a failed
# broadcast.
#
# --unattended replaces the human-typed broadcast confirmations with automated checks (chain id,
# contract identity, cost-within-10%-of-reference, spend cap, verify-live after every circuit).
# It requires --max-okb and a FORGE_PASSWORD_FILE (default ~/.forgeout/pw) that: exists, is mode
# 600 exactly, and is NOT inside this repo. The password file's PATH is passed to cast's own
# --password-file flag by the underlying scripts - this script never opens, reads, or echoes it.
#
# Usage: scripts/go-live.sh <account-name> [--variant gc014|gc039] [--broadcast]
#                            [--unattended --max-okb <value>]
set -euo pipefail

ACCOUNT="${1:?usage: go-live.sh <account-name> [--variant gc014|gc039] [--broadcast] [--unattended --max-okb <value>]}"
shift || true
VARIANT="gc014"
BROADCAST=0
UNATTENDED=0
MAX_OKB=""
while [ $# -gt 0 ]; do
  case "$1" in
    --variant) VARIANT="${2:?--variant needs gc014 or gc039}"; shift 2 ;;
    --broadcast) BROADCAST=1; shift ;;
    --unattended) UNATTENDED=1; shift ;;
    --max-okb) MAX_OKB="${2:?--max-okb needs a value}"; shift 2 ;;
    --private-key|--privatekey|-pk)
      echo "ABORT: --private-key is never accepted by this script. Use KEYSTORE_ACCOUNT via <account-name> only." >&2
      exit 1 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ "$VARIANT" != "gc014" ] && [ "$VARIANT" != "gc039" ]; then
  echo "ABORT: --variant must be gc014 or gc039, got '$VARIANT'" >&2
  exit 1
fi

RPC="${FORGE_RPC_URL:-https://rpc.xlayer.tech}"  # override only for testing against a local fork
CHAIN_ID=196
PROCESSOR="0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355"  # OrderGuard (PHASE 7 default)
SPEND_CAP_OKB=0.05462   # config/cost.ts PHASE8_SPEND_CAP_OKB - keep in sync by hand
# config/chains.ts FORGE_REGISTRY_ADDRESS - keep in sync by hand. Defaulting here (rather than
# requiring the caller to export it) is the actual fix for the real stall this project hit: a
# prior run deployed the registry for real, but the address only ever lived in that one shell's
# env var, so a fresh invocation had no way to know it already existed and would have redeployed.
FORGE_REGISTRY_ADDRESS="${FORGE_REGISTRY_ADDRESS:-0xAFDd108b0efCC1FF4d1e1d32579F80501774912d}"
FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
CAST="$FOUNDRY_BIN/cast"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Real per-step cost references, from the real dry-run this project already ran (docs/COSTS.md,
# gc014 variant) - keep in sync by hand. Used ONLY in --unattended mode's 10%-tolerance check,
# to catch the real on-chain fee parameters having drifted upward since that dry-run.
declare -A REFERENCE_OKB=(
  [deploy]="0.0000093157"
  [12]="0.00756" [37]="0.00556" [50]="0.00656" [14]="0.00316" [46]="0.01116"
)

AUTO_CONFIRM=0
if [ "$UNATTENDED" -eq 1 ]; then
  if [ "$BROADCAST" -eq 0 ]; then
    echo "ABORT: --unattended only makes sense with --broadcast (it replaces the broadcast confirmation, there is nothing to automate in a dry run)." >&2
    exit 1
  fi
  if [ -z "$MAX_OKB" ]; then
    echo "ABORT: --unattended requires --max-okb <value> explicitly - no silent default." >&2
    exit 1
  fi
  # Unattended's cap is the stricter of the two - never silently loosen the existing cap.
  SPEND_CAP_OKB=$(python3 -c "print(min($SPEND_CAP_OKB, $MAX_OKB))")

  FORGE_PASSWORD_FILE="${FORGE_PASSWORD_FILE:-$HOME/.forgeout/pw}"
  if [ ! -f "$FORGE_PASSWORD_FILE" ]; then
    echo "ABORT: FORGE_PASSWORD_FILE ($FORGE_PASSWORD_FILE) does not exist." >&2
    exit 1
  fi
  PW_MODE=$(stat -c "%a" "$FORGE_PASSWORD_FILE" 2>/dev/null || stat -f "%Lp" "$FORGE_PASSWORD_FILE")
  if [ "$PW_MODE" != "600" ]; then
    echo "ABORT: FORGE_PASSWORD_FILE ($FORGE_PASSWORD_FILE) must be mode 600 exactly, got $PW_MODE." >&2
    exit 1
  fi
  PW_REAL="$(cd "$(dirname "$FORGE_PASSWORD_FILE")" && pwd)/$(basename "$FORGE_PASSWORD_FILE")"
  case "$PW_REAL" in
    "$ROOT"/*|"$ROOT")
      echo "ABORT: FORGE_PASSWORD_FILE resolves to $PW_REAL, which is inside this repo ($ROOT). It must live outside the repo." >&2
      exit 1 ;;
  esac
  AUTO_CONFIRM=1
  echo "== unattended mode: FORGE_PASSWORD_FILE=$FORGE_PASSWORD_FILE (mode 600, outside repo, verified) max-okb=$MAX_OKB effective-cap=$SPEND_CAP_OKB =="
  echo
fi

check_reference() {
  local step_okb="$1" ref_key="$2" label="$3"
  [ "$UNATTENDED" -eq 1 ] || return 0
  local ref ceiling over
  ref="${REFERENCE_OKB[$ref_key]:-}"
  [ -z "$ref" ] && return 0
  ceiling=$(python3 -c "print($ref * 1.10)")
  over=$(python3 -c "print(1 if $step_okb > $ceiling else 0)")
  echo "  [unattended check] $label: real=$step_okb OKB  reference=$ref OKB  +10% ceiling=$ceiling OKB"
  if [ "$over" = "1" ]; then
    echo "ABORT: $label's real cost $step_okb OKB exceeds its reference+10% ceiling $ceiling OKB. Fees may have changed on-chain since the last dry-run. Stopping - do not proceed." >&2
    exit 1
  fi
}

# cast wallet address --account decrypts the keystore to re-derive the address - it needs the
# real password. In --unattended mode it's supplied via --password-file (never printed/logged by
# this script); otherwise it's prompted interactively (or skipped gracefully if no tty - see the
# else branch below, unchanged from before unattended mode existed).
DEPLOYER=""
ADDR_ARGS=(wallet address --account "$ACCOUNT")
[ "$UNATTENDED" -eq 1 ] && ADDR_ARGS+=(--password-file "$FORGE_PASSWORD_FILE")
if DEPLOYER=$("$CAST" "${ADDR_ARGS[@]}" 2>/dev/null); then
  echo "== go-live: account=$ACCOUNT address=$DEPLOYER variant=$VARIANT broadcast=$BROADCAST unattended=$UNATTENDED =="
  echo
  echo "--- step 0: preflight ---"
  if ! bash "$ROOT/scripts/preflight.sh" "$DEPLOYER" --variant "$VARIANT"; then
    echo "ABORT: preflight failed. Fix the FAILs above before running go-live.sh again." >&2
    exit 1
  fi
else
  if [ "$UNATTENDED" -eq 1 ]; then
    echo "ABORT: --unattended requires decrypting the keystore to run a real preflight check first; could not derive the address from '$ACCOUNT' via the given FORGE_PASSWORD_FILE. Check the password file is correct for this account." >&2
    exit 1
  fi
  echo "== go-live: account=$ACCOUNT variant=$VARIANT broadcast=$BROADCAST unattended=$UNATTENDED =="
  echo
  echo "--- step 0: preflight ---"
  echo "SKIP: could not decrypt keystore '$ACCOUNT' non-interactively (no password prompt available"
  echo "  in this context) - this is expected when go-live.sh is run other than at a real"
  echo "  interactive terminal. Confirm you already ran 'scripts/preflight.sh <your-address>"
  echo "  --variant $VARIANT' yourself and it showed ALL CHECKS PASS before continuing."
fi
echo

# PHASE 9's literal text lists GC-012/037/050/014/046 as the always-run set, with GC-039
# ADDITIVE (not substituted) only under --variant gc039. This differs from docs/COSTS.md's
# Phase 8 framing (GC-014 OR GC-039 as a 5-circuit either/or) - flagged explicitly in this
# run's own output below so the owner notices before relying on a stale total.
CIRCUITS=(12 37 50 14 46)
if [ "$VARIANT" = "gc039" ]; then
  CIRCUITS+=(39)
  echo "NOTE: --variant gc039 ADDS GC-039 on top of the base 5 circuits (per Phase 9's literal"
  echo "spec), it does not replace GC-014 as docs/COSTS.md's Phase 8 framing implied. This run"
  echo "will therefore cost more than either of Phase 8's two quoted totals. Real costs below"
  echo "are computed live, not read from that doc."
  echo
fi

CUMULATIVE_OKB="0"

check_cap() {
  local step_okb="$1" label="$2"
  local new_total over
  new_total=$(python3 -c "print($CUMULATIVE_OKB + $step_okb)")
  over=$(python3 -c "print(1 if $new_total > $SPEND_CAP_OKB else 0)")
  echo "  $label: step=$step_okb OKB   cumulative=$new_total OKB   cap=$SPEND_CAP_OKB OKB"
  if [ "$over" = "1" ]; then
    echo "ABORT: cumulative spend $new_total OKB would exceed cap $SPEND_CAP_OKB OKB. Stopping the whole run." >&2
    exit 1
  fi
  CUMULATIVE_OKB="$new_total"
}

already_done() {
  local task="$1" label
  label="GC-$(printf '%03d' "$task")"
  grep -q "$label" "$ROOT/docs/TAPEOUTS.md" 2>/dev/null || return 1
  [ -z "${FORGE_REGISTRY_ADDRESS:-}" ] && return 1
  local spec_hash entry
  spec_hash=$("$CAST" keccak "$label")
  entry=$("$CAST" call "$FORGE_REGISTRY_ADDRESS" \
    "best(bytes32)(address,uint256,uint32,uint32,uint8,uint8,bool,bytes32,address)" \
    "$spec_hash" --rpc-url "$RPC" 2>/dev/null) || return 1
  case "$entry" in *"0x0000000000000000000000000000000000000000, 0, 0, 0, 0, 0, false"*) return 1 ;; esac
  return 0
}

echo "--- step 1: ForgeRegistry ---"
REAL_CHAIN_ID=$("$CAST" chain-id --rpc-url "$RPC")
if [ "$REAL_CHAIN_ID" != "$CHAIN_ID" ]; then
  echo "ABORT: live chain id is $REAL_CHAIN_ID, expected $CHAIN_ID. Refusing to proceed." >&2
  exit 1
fi
EXISTING_CODE=$("$CAST" code "$FORGE_REGISTRY_ADDRESS" --rpc-url "$RPC")
if [ "$EXISTING_CODE" != "0x" ]; then
  echo "SKIP (resumed): FORGE_REGISTRY_ADDRESS=$FORGE_REGISTRY_ADDRESS already has real code - not redeploying."
else
  DEPLOY_ARGS=()
  [ "$BROADCAST" -eq 1 ] && DEPLOY_ARGS=(--broadcast)
  set +e
  DEPLOY_OUT=$(KEYSTORE_ACCOUNT="$ACCOUNT" AUTO_CONFIRM="$AUTO_CONFIRM" FORGE_PASSWORD_FILE="${FORGE_PASSWORD_FILE:-}" \
    bash "$ROOT/scripts/deploy-registry.sh" "${DEPLOY_ARGS[@]}" 2>&1)
  DEPLOY_RC=$?
  set -e
  echo "$DEPLOY_OUT"
  if [ "$DEPLOY_RC" -ne 0 ]; then
    echo "ABORT: deploy-registry.sh failed." >&2
    exit 1
  fi
  DEPLOY_EST=$(echo "$DEPLOY_OUT" | grep -oE 'estimated cost: [0-9.]+ OKB' | grep -oE '[0-9.]+' | head -1)
  [ -n "$DEPLOY_EST" ] && check_reference "$DEPLOY_EST" "deploy" "deploy-registry"
  if [ "$BROADCAST" -eq 0 ]; then
    echo "  (dry-run only - nothing deployed, no address to capture)"
  else
    NEW_ADDR=$(echo "$DEPLOY_OUT" | grep -oE 'Deployed to: 0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
    NEW_TX=$(echo "$DEPLOY_OUT" | grep -oE 'Transaction hash: 0x[0-9a-fA-F]{64}' | grep -oE '0x[0-9a-fA-F]{64}' | head -1)
    if [ -z "$NEW_ADDR" ] || [ -z "$NEW_TX" ]; then
      echo "ABORT: deploy appeared to run but this script could not parse the deployed address/tx hash from its output. Stopping rather than guessing - check manually before re-running." >&2
      exit 1
    fi
    STATUS=$("$CAST" receipt "$NEW_TX" --rpc-url "$RPC" --field status 2>/dev/null || echo "")
    REAL_CODE=$("$CAST" code "$NEW_ADDR" --rpc-url "$RPC")
    if { [ "$STATUS" != "1" ] && [ "$STATUS" != "0x1" ]; } || [ "$REAL_CODE" = "0x" ]; then
      echo "ABORT: independent receipt/code check did not confirm a successful deployment (status=$STATUS). Stopping - do not trust forge's own stdout alone." >&2
      exit 1
    fi
    echo "  independently verified: receipt status=1 and real code present at $NEW_ADDR"
    FORGE_REGISTRY_ADDRESS="$NEW_ADDR"
    sed -i "s|^export const FORGE_REGISTRY_ADDRESS = \".*\";.*|export const FORGE_REGISTRY_ADDRESS = \"$NEW_ADDR\"; // real deploy, tx $NEW_TX, captured automatically by go-live.sh after independent receipt verification|" "$ROOT/config/chains.ts"
    echo "  recorded in config/chains.ts: FORGE_REGISTRY_ADDRESS=$NEW_ADDR"
  fi
fi
echo

for task in "${CIRCUITS[@]}"; do
  LABEL="GC-$(printf '%03d' "$task")"
  echo "--- $LABEL ---"
  if already_done "$task"; then
    echo "SKIP (resumed): $LABEL already recorded in docs/TAPEOUTS.md and confirmed live in the registry."
    echo
    continue
  fi

  if [ "$task" = "39" ]; then
    REMAINING=$(python3 -c "print($SPEND_CAP_OKB - $CUMULATIVE_OKB)")
    echo "  GC-039 is OPTIONAL and LAST - remaining budget before it: $REMAINING OKB"
  fi

  TO_ARGS=()
  [ "$BROADCAST" -eq 1 ] && TO_ARGS=(--broadcast)
  set +e
  TO_OUT=$(KEYSTORE_ACCOUNT="$ACCOUNT" AUTO_CONFIRM="$AUTO_CONFIRM" FORGE_PASSWORD_FILE="${FORGE_PASSWORD_FILE:-}" MAX_OKB_OVERRIDE="${MAX_OKB:-}" \
    bash "$ROOT/scripts/tapeout.sh" "$task" "${TO_ARGS[@]}" 2>&1)
  TO_RC=$?
  set -e
  echo "$TO_OUT"
  if [ "$TO_RC" -ne 0 ]; then
    echo "ABORT: tapeout.sh failed for $LABEL (exit $TO_RC). Stopping the whole run." >&2
    exit 1
  fi
  STEP_OKB=$(echo "$TO_OUT" | grep -oE 'total=[0-9.]+ OKB' | grep -oE '[0-9.]+' | head -1)
  [ -z "$STEP_OKB" ] && STEP_OKB="0"
  echo "  before broadcast: circuit=$LABEL contract=$PROCESSOR chainId=$CHAIN_ID cost=$STEP_OKB OKB"
  check_reference "$STEP_OKB" "$task" "tapeout($LABEL)"
  check_cap "$STEP_OKB" "tapeout($LABEL)"

  if [ "$BROADCAST" -eq 0 ]; then
    echo "  (dry-run only - register.sh needs a real circuit id from a real tapeout, which hasn't happened; skipping register/verify for $LABEL this run)"
    echo
    continue
  fi

  CIRCUIT_ID=$(tail -1 "$ROOT/docs/TAPEOUTS.md" | grep -oE 'circuitId=[0-9]+' | grep -oE '[0-9]+' || true)
  if [ -z "$CIRCUIT_ID" ]; then
    echo "ABORT: could not read the real circuit id for $LABEL from docs/TAPEOUTS.md after tapeout.sh ran." >&2
    exit 1
  fi
  if [ -z "${FORGE_REGISTRY_ADDRESS:-}" ]; then
    echo "ABORT: FORGE_REGISTRY_ADDRESS is not set - export the real deployed address before register.sh can run." >&2
    exit 1
  fi

  REG_ARGS=()
  [ "$BROADCAST" -eq 1 ] && REG_ARGS=(--broadcast)
  FORGE_REGISTRY_ADDRESS="$FORGE_REGISTRY_ADDRESS" KEYSTORE_ACCOUNT="$ACCOUNT" AUTO_CONFIRM="$AUTO_CONFIRM" FORGE_PASSWORD_FILE="${FORGE_PASSWORD_FILE:-}" \
    bash "$ROOT/scripts/register.sh" "$task" "$CIRCUIT_ID" "${REG_ARGS[@]}" \
    || { echo "ABORT: register.sh failed for $LABEL. Stopping the whole run." >&2; exit 1; }

  TAPEOUT_TX=$(tail -2 "$ROOT/docs/TAPEOUTS.md" | grep -oE 'tx=0x[0-9a-fA-F]+' | head -1 | cut -d= -f2 || true)
  set +e
  VERIFY_OUT=$(bash "$ROOT/scripts/verify-live.sh" "$task" "$CIRCUIT_ID" "$TAPEOUT_TX" 2>&1)
  VERIFY_RC=$?
  set -e
  echo "$VERIFY_OUT"
  if [ "$VERIFY_RC" -ne 0 ] || echo "$VERIFY_OUT" | grep -q "SUMMARY: FAIL"; then
    echo "ABORT: verify-live.sh reported a MISMATCH or error for $LABEL. Stopping the whole run - do not continue to the next circuit." >&2
    exit 1
  fi
  echo
done

echo "== go-live run complete. cumulative tape-out spend: $CUMULATIVE_OKB OKB (cap $SPEND_CAP_OKB OKB) =="
if [ "$BROADCAST" -eq 0 ]; then
  echo "This was a DRY RUN. Nothing was sent. Re-run with --broadcast to actually proceed, one confirmed step at a time."
fi
