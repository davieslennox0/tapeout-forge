#!/usr/bin/env bash
# PHASE 9.5: real tests for scripts/go-live.sh, against a local Anvil fork (never the real
# chain, never a real key - impersonation only). Run manually: scripts/test-go-live.sh
# Requires: anvil already running at $FORGE_RPC_URL (default http://localhost:8549) with
# ForgeRegistry deployed and a real GC-012 entry submitted (see docs/NEW.md for the exact
# fixture setup used when this was last run for real).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC="${FORGE_RPC_URL:-http://localhost:8549}"
REGISTRY="${FORGE_REGISTRY_ADDRESS:?set FORGE_REGISTRY_ADDRESS to the fork-deployed registry first}"
CAST="$HOME/.foundry/bin/cast"
PASS=0
FAIL=0
ok()  { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

echo "== test 1: --private-key is rejected outright =="
if bash "$ROOT/scripts/go-live.sh" my-forgeout-key --private-key 0xdead >/tmp/t1.log 2>&1; then
  bad "accepted --private-key (should have aborted)"
else
  grep -q "never accepted" /tmp/t1.log && ok "rejects --private-key" || bad "aborted but not for the right reason"
fi

echo "== test 2: an invalid --variant is rejected =="
if bash "$ROOT/scripts/go-live.sh" my-forgeout-key --variant bogus >/tmp/t2.log 2>&1; then
  bad "accepted an invalid --variant"
else
  grep -q "must be gc014 or gc039" /tmp/t2.log && ok "rejects invalid --variant" || bad "aborted but not for the right reason"
fi

echo "== test 3: resume-skip - a real on-chain-recorded circuit is detected and skipped =="
# Real fixture (set up once against the fork, see docs/NEW.md): registry has a real verified
# entry for specHash(GC-012). docs/TAPEOUTS.md must also mention GC-012 for the skip (both
# conditions are required, by design - the file alone is never trusted).
grep -q "GC-012" "$ROOT/docs/TAPEOUTS.md" 2>/dev/null || echo "- $(date -u +%Y-%m-%d): GC-012 (test fixture, fork-only, see test 3)" >> /tmp/fake-tapeouts.md
TAPEOUTS_BACKUP=$(cat "$ROOT/docs/TAPEOUTS.md")
echo "- $(date -u +%Y-%m-%d): GC-012 (test fixture for resume-skip, fork-only)" >> "$ROOT/docs/TAPEOUTS.md"
OUT=$(FORGE_RPC_URL="$RPC" FORGE_REGISTRY_ADDRESS="$REGISTRY" bash "$ROOT/scripts/go-live.sh" my-forgeout-key --variant gc014 2>&1)
echo "$TAPEOUTS_BACKUP" > "$ROOT/docs/TAPEOUTS.md"  # restore immediately, real file, never leave altered
echo "$OUT" | grep -q "SKIP (resumed): GC-012" && ok "resume-skip detects a real already-done circuit" || bad "did not skip GC-012 as expected"
echo "$OUT" | grep -q "^--- GC-037 ---" && ok "still processes the next circuit (GC-037) normally" || bad "stopped processing after the skip"

echo "== test 4: spend-cap abort - a cumulative cost over an artificially tiny cap aborts the whole run =="
# Must stay inside scripts/ so BASH_SOURCE-relative ROOT resolution still finds the repo root.
TMPSCRIPT="$ROOT/scripts/.go-live-test-cap.sh"
sed 's/^SPEND_CAP_OKB=0.05462.*/SPEND_CAP_OKB=0.005/' "$ROOT/scripts/go-live.sh" > "$TMPSCRIPT"
chmod +x "$TMPSCRIPT"
if OUT=$(FORGE_RPC_URL="$RPC" bash "$TMPSCRIPT" my-forgeout-key --variant gc014 2>&1); then
  bad "did not abort despite exceeding the tiny test cap"
else
  echo "$OUT" | grep -q "would exceed cap" && ok "aborts the whole run when cumulative spend exceeds the cap" || bad "aborted but not for the right reason"
fi
rm -f "$TMPSCRIPT"

echo "== test 5: a verify-live mismatch aborts the whole run (logic check - string match on its real output contract) =="
# verify-live.sh's own real contract: it prints "SUMMARY: FAIL" on any mismatch and go-live.sh
# greps for exactly that string to decide whether to abort. Confirmed by direct inspection of
# both scripts' real current source (not assumed): go-live.sh's check is
# `grep -q "SUMMARY: FAIL"` immediately after calling verify-live.sh; verify-live.sh sets
# SUMMARY=FAIL whenever NETLIST_MATCH != PASS or MISMATCHES != 0, and always prints
# "SUMMARY: $SUMMARY" unconditionally. This is a structural guarantee, not a race - exercising
# it end-to-end would require a real broadcasted mismatch, which this phase will never send for
# real; the grep contract between the two real files is what's being verified here.
if grep -q 'grep -q "SUMMARY: FAIL"' "$ROOT/scripts/go-live.sh" && grep -q 'echo "SUMMARY: \$SUMMARY' "$ROOT/scripts/verify-live.sh"; then
  ok "go-live.sh's abort condition and verify-live.sh's real output format are confirmed consistent by direct source inspection"
else
  bad "the grep contract between go-live.sh and verify-live.sh does not match - a real mismatch would NOT be caught"
fi

echo
echo "== $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
