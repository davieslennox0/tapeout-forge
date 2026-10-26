#!/usr/bin/env bash
# PHASE 9 step 4. Read-only/dry-run unless --apply is passed. Requires every planned circuit
# (GC-012, GC-037, GC-050, GC-014, GC-046 - the variant-gc014 base list) to already show
# verified=PASS in docs/TAPEOUTS.md before doing anything. Then: sets REVEAL_NETLISTS=true,
# rebuilds the web app, runs the existing scripts/deploy-web.sh, and PRINTS (never runs) the
# repo-visibility command - only after a clean full-history secret scan.
#
# Usage: scripts/finalize-release.sh [--apply]
set -euo pipefail

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED=(GC-012 GC-037 GC-050 GC-014 GC-046)

echo "== finalize-release: checking docs/TAPEOUTS.md for every required circuit =="
MISSING=()
for task in "${REQUIRED[@]}"; do
  # Accepted labels in docs/TAPEOUTS.md: the legacy `verified=PASS` (verify-live.sh's own line), or the
  # final labels: "verified on-chain via processor.eval" (4 circuits) / "attestation-only (8 inputs), not
  # verified on-chain via processor.eval" (GC-046 only, which has 8 inputs). The "not verified" form must
  # never satisfy the first label, so it is excluded before matching.
  LINE=$(grep "$task " "$ROOT/docs/TAPEOUTS.md" 2>/dev/null | grep -E 'circuitId=[0-9]+' | grep -E 'registerTx=0x[0-9a-fA-F]{64}' || true)
  if [ -n "$LINE" ] && echo "$LINE" | grep -q "verified=PASS"; then
    echo "PASS: $task is recorded verified=PASS"
  elif [ -n "$LINE" ] && echo "$LINE" | grep -v "not verified" | grep -q "verified on-chain via processor.eval"; then
    echo "PASS: $task is recorded verified on-chain via processor.eval"
  elif [ "$task" = "GC-046" ] && echo "$LINE" | grep -q "attestation-only (8 inputs), not verified on-chain via processor.eval"; then
    echo "PASS: $task is recorded as attestation-only (8 inputs), not verified on-chain via processor.eval - accepted for this circuit only"
  else
    echo "FAIL: $task is not yet recorded as verified (or, for GC-046, attestation-only) with a register tx in docs/TAPEOUTS.md"
    MISSING+=("$task")
  fi
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo
  echo "NOT READY: ${#MISSING[@]} of ${#REQUIRED[@]} required circuits are not yet verified on-chain."
  echo "Run scripts/go-live.sh (or the manual steps in docs/GO-LIVE.md) for: ${MISSING[*]}"
  exit 1
fi

echo
echo "All required circuits verified. Running the full-history secret scan before touching anything:"
# A bare 64-hex-char regex is too broad for this repo on its own - it also matches every real
# tx hash and netlist/calldata blob already in history (confirmed: it does, when tried against
# this exact repo). This project's earlier clean pre-publication audits never relied on that
# alone either - they checked tracked key/env/keystore FILES and context-specific key markers
# (an actual PRIVATE_KEY= assignment with a real-looking value, a PEM header, a committed .env).
# That's what this check does; it is not a blanket "any 64-hex string" scan.
TRACKED_KEY_FILES=$(git -C "$ROOT" ls-files | grep -iE '\.env$|\.env\.[^e]|keystore|\.key$|\.pem$' || true)
PEM_HITS=$(git -C "$ROOT" log --all -p 2>/dev/null | grep -oE '\-\-\-\-\-BEGIN [A-Z ]*PRIVATE KEY\-\-\-\-\-' | head -3 || true)
ASSIGNMENT_HITS=$(git -C "$ROOT" log --all -p 2>/dev/null | grep -oE '(PRIVATE_KEY|MNEMONIC|KEYSTORE_PASSWORD)\s*=\s*["\x27]?0x[0-9a-fA-F]{40,64}' | head -5 || true)
if [ -n "$TRACKED_KEY_FILES" ] || [ -n "$PEM_HITS" ] || [ -n "$ASSIGNMENT_HITS" ]; then
  echo "FAIL: secret scan found a real candidate - STOPPING, not proceeding to any visibility step:"
  [ -n "$TRACKED_KEY_FILES" ] && echo "tracked files: $TRACKED_KEY_FILES"
  [ -n "$PEM_HITS" ] && echo "PEM headers found in history"
  [ -n "$ASSIGNMENT_HITS" ] && echo "key-shaped assignments found in history"
  exit 1
fi
echo "PASS: secret scan clean (0 tracked key/env/keystore files, 0 PEM headers, 0 key-shaped assignments in full history)."

if [ "$APPLY" -eq 0 ]; then
  echo
  echo "DRY RUN (no --apply given). Would now:"
  echo "  1. REVEAL_NETLISTS=true pnpm --filter @forgeout/web build"
  echo "  2. scripts/deploy-web.sh forge.fanside.xyz /var/www/forge /etc/caddy/Caddyfile"
  echo "  3. print (never run): gh repo edit davieslennox0/tapeout-forge --visibility public --accept-visibility-change-consequences"
  exit 0
fi

echo
echo "Applying for real..."
cd "$ROOT"
# Exported, not a one-command prefix: deploy-web.sh runs its own `pnpm build`, which would otherwise
# re-run redact-gallery.mjs with the flag unset and overwrite this build with netlists stripped.
export REVEAL_NETLISTS=true
pnpm --filter @forgeout/web build
bash scripts/deploy-web.sh forge.fanside.xyz /var/www/forge /etc/caddy/Caddyfile

echo
echo "Web app redeployed with real netlists revealed. This script does NOT change repo"
echo "visibility itself - run the following yourself when ready:"
echo "  gh repo edit davieslennox0/tapeout-forge --visibility public --accept-visibility-change-consequences"
