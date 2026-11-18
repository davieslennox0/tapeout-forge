#!/usr/bin/env bash
# deweb-publish.sh - generic publisher for TapeKit DeWEB sites on X Layer (chain 196).
#
# Publishes a static build folder to a TapeOut circuit NFT's container via the real SiteRegistry
# contract calls (no HashPort console, no off-chain server - direct on-chain writes). Not specific
# to Forgeout: point it at any container (or any processor + token id) and any static folder.
#
# Contracts (X Layer mainnet; same addresses TapeKit uses on Base too), verified read-only against
# the live chain and cross-checked against a real published site (proofdrop, container
# 0xa5bfe4319777DC89b922D14Eb6B37F6621Fd535c, name 1.2.413.tape) before this script was written -
# every field it returned (size 11137, contentType "text/html; charset=utf-8", sha256Hash,
# chunkCount 1) matched that site's own published README exactly:
#   Processor factory : 0x1f09DAeFA827f02CBb40967cc91b259763760761
#   Container opener   : 0x536adD8F30f03b69f6fbF29d425A816A0dC50106
#   SiteRegistry proxy : 0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6
#   DomainBinding proxy: 0x68809Fd2fb343aA57D0aeB7f33Defe477c9666f9
#
# Both processor beacons (the shared beacon every TapeOut processor proxies to) were frozen
# ownerless on 2026-10-22 per TapeKit's own changelog - no one can change processor logic anymore.
# This script never accepts a raw --private-key: only KEYSTORE_ACCOUNT (Foundry `cast wallet`) or
# KEY_FILE. Dry-run (the default) needs no key at all.
#
# Usage:
#   deweb-publish.sh <build-dir> --processor <addr> --token-id <id> [options]
#   deweb-publish.sh <build-dir> --container <addr> [options]            # container must already be opened
#
# Options:
#   --rpc <url>          override RPC (default: $FORGE_RPC_URL or https://rpc.xlayer.tech)
#   --from <address>     signer address used for read-only gas estimates in dry-run mode.
#                        Defaults to ownerOf(token-id) when --processor/--token-id is given.
#                        Required with --container (no on-chain owner lookup available generically).
#   --fallback <path>    set the SPA fallback path (e.g. index.html) if not already set to it
#   --remove <path>      remove this path from the site (repeatable)
#   --bind <name>        bind/renew this tape:// name to the container (e.g. "6.2.272" or "6.2.272.tape")
#   --months <n>         months to pay for --bind (1-120, required with --bind)
#   --resolve-name       do the (slow, O(cpuCount) factory scan) lookup to print the human tape://
#                        name for --processor/--token-id. Off by default; result is cached in
#                        <manifest-dir>/.deweb-cpu-cache.json so later runs are instant.
#   --manifest <path>    output manifest path (default: ./deweb-manifest.json)
#   --broadcast          actually send transactions (default: dry run, never sends anything)
#   -h, --help
#
# Env (broadcast only): KEYSTORE_ACCOUNT or KEY_FILE (never a raw private key), FORGE_PASSWORD_FILE.
set -euo pipefail

usage() { sed -n '15,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

RPC="${FORGE_RPC_URL:-https://rpc.xlayer.tech}"
CHAIN_ID=196
FACTORY=0x1f09DAeFA827f02CBb40967cc91b259763760761
OPENER=0x536adD8F30f03b69f6fbF29d425A816A0dC50106
SITEREG=0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6
DOMBIND=0x68809Fd2fb343aA57D0aeB7f33Defe477c9666f9
CHUNK_MAX=24000

FOUNDRY_BIN="${FOUNDRY_BIN:-$HOME/.foundry/bin}"
CAST="$FOUNDRY_BIN/cast"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/lib-tx.sh
. "$REPO_ROOT/scripts/lib-tx.sh"

num() { awk '{print $1}'; }
strip_quotes() { sed -e 's/^"//' -e 's/"$//'; }

[ "$#" -ge 1 ] || { usage; exit 1; }
BUILD_DIR="$1"; shift
[ -d "$BUILD_DIR" ] || { echo "ABORT: build dir '$BUILD_DIR' does not exist or is not a directory." >&2; exit 1; }

PROCESSOR=""; TOKEN_ID=""; CONTAINER=""; FROM_ADDR=""; FALLBACK_PATH=""
BIND_NAME=""; BIND_MONTHS=""; RESOLVE_NAME=0; MANIFEST="./deweb-manifest.json"
BROADCAST=0
REMOVE_PATHS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --processor) PROCESSOR="$2"; shift 2 ;;
    --token-id) TOKEN_ID="$2"; shift 2 ;;
    --container) CONTAINER="$2"; shift 2 ;;
    --rpc) RPC="$2"; shift 2 ;;
    --from) FROM_ADDR="$2"; shift 2 ;;
    --fallback) FALLBACK_PATH="$2"; shift 2 ;;
    --remove) REMOVE_PATHS+=("$2"); shift 2 ;;
    --bind) BIND_NAME="$2"; shift 2 ;;
    --months) BIND_MONTHS="$2"; shift 2 ;;
    --resolve-name) RESOLVE_NAME=1; shift ;;
    --manifest) MANIFEST="$2"; shift 2 ;;
    --broadcast) BROADCAST=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ABORT: unknown argument '$1'." >&2; usage; exit 1 ;;
  esac
done

if [ -n "$CONTAINER" ] && { [ -n "$PROCESSOR" ] || [ -n "$TOKEN_ID" ]; }; then
  echo "ABORT: pass either --container, or --processor + --token-id, not both." >&2; exit 1
fi
if [ -z "$CONTAINER" ] && { [ -z "$PROCESSOR" ] || [ -z "$TOKEN_ID" ]; }; then
  echo "ABORT: pass --container <addr>, or both --processor <addr> and --token-id <id>." >&2; exit 1
fi
if [ -n "$BIND_NAME" ] && [ -z "$BIND_MONTHS" ]; then
  echo "ABORT: --bind requires --months." >&2; exit 1
fi

echo "== safety checks =="
REAL_CHAIN_ID=$("$CAST" chain-id --rpc-url "$RPC")
[ "$REAL_CHAIN_ID" = "$CHAIN_ID" ] || { echo "ABORT: RPC chain id is $REAL_CHAIN_ID, expected $CHAIN_ID." >&2; exit 1; }
for a in "$OPENER" "$SITEREG" "$DOMBIND"; do
  code=$("$CAST" code "$a" --rpc-url "$RPC")
  [ "$code" != "0x" ] && [ -n "$code" ] || { echo "ABORT: no code at $a - refusing to proceed." >&2; exit 1; }
done
echo "ok: chain id == $CHAIN_ID, opener/SiteRegistry/DomainBinding all have code"

# --- Resolve the container -----------------------------------------------------------------
OPEN_PLANNED=0
if [ -n "$PROCESSOR" ]; then
  code=$("$CAST" code "$PROCESSOR" --rpc-url "$RPC")
  [ "$code" != "0x" ] && [ -n "$code" ] || { echo "ABORT: no code at processor $PROCESSOR." >&2; exit 1; }
  IS_CPU=$("$CAST" call "$FACTORY" "isCPU(address)(bool)" "$PROCESSOR" --rpc-url "$RPC")
  [ "$IS_CPU" = "true" ] || { echo "ABORT: $PROCESSOR is not a TapeOut processor created by the official factory ($FACTORY)." >&2; exit 1; }
  OWNER=$("$CAST" call "$PROCESSOR" "ownerOf(uint256)(address)" "$TOKEN_ID" --rpc-url "$RPC") || {
    echo "ABORT: ownerOf($TOKEN_ID) reverted - that token id probably doesn't exist on this processor." >&2; exit 1; }
  echo "circuit #$TOKEN_ID on $PROCESSOR is owned by $OWNER"
  [ -z "$FROM_ADDR" ] && FROM_ADDR="$OWNER"
  CONTAINER=$("$CAST" call "$OPENER" "accountOf(address,uint256)(address)" "$PROCESSOR" "$TOKEN_ID" --rpc-url "$RPC")
  OPENED=$("$CAST" call "$OPENER" "isOpened(address,uint256)(bool)" "$PROCESSOR" "$TOKEN_ID" --rpc-url "$RPC")
  echo "container: $CONTAINER (opened: $OPENED)"
  [ "$OPENED" = "false" ] && OPEN_PLANNED=1
else
  code=$("$CAST" code "$CONTAINER" --rpc-url "$RPC")
  [ "$code" != "0x" ] && [ -n "$code" ] || { echo "ABORT: no code at container $CONTAINER." >&2; exit 1; }
  OPENED=$("$CAST" call "$SITEREG" "isOpenedContainer(address)(bool)" "$CONTAINER" --rpc-url "$RPC")
  if [ "$OPENED" != "true" ]; then
    echo "ABORT: $CONTAINER is not an opened TapeOut container. Re-run with --processor/--token-id so this script can open it, or open it yourself first." >&2
    exit 1
  fi
  echo "container: $CONTAINER (already opened)"
  if [ -z "$FROM_ADDR" ]; then
    echo "ABORT: --from <address> is required when using --container directly (needed for accurate gas estimates on onlyEditor-gated calls)." >&2
    exit 1
  fi
fi

# --- Walk the build folder, decide what needs publishing -----------------------------------
mime_for() {
  case "${1##*.}" in
    html) echo "text/html; charset=utf-8" ;;
    css) echo "text/css; charset=utf-8" ;;
    js|mjs) echo "text/javascript; charset=utf-8" ;;
    json) echo "application/json" ;;
    svg) echo "image/svg+xml" ;;
    png) echo "image/png" ;;
    jpg|jpeg) echo "image/jpeg" ;;
    gif) echo "image/gif" ;;
    webp) echo "image/webp" ;;
    ico) echo "image/x-icon" ;;
    woff) echo "font/woff" ;;
    woff2) echo "font/woff2" ;;
    ttf) echo "font/ttf" ;;
    wasm) echo "application/wasm" ;;
    txt) echo "text/plain; charset=utf-8" ;;
    xml) echo "application/xml" ;;
    *) echo "application/octet-stream" ;;
  esac
}

chunk_hex() { python3 -I -c "
import sys
with open(sys.argv[1],'rb') as f:
    f.seek(int(sys.argv[2]))
    print('0x' + f.read(int(sys.argv[3])).hex())
" "$1" "$2" "$3"; }

check_path_rules() {
  python3 -I -c "
import sys, unicodedata
p = sys.argv[1]
segs = p.split('/')
if '.' in segs or '..' in segs:
    sys.exit('dot-segment')
if any(ord(c) < 0x20 for c in p):
    sys.exit('control-char')
if not unicodedata.is_normalized('NFC', p):
    sys.exit('not-nfc')
" "$1"
}

declare -a PLAN_PUTFILE_PATH=() PLAN_PUTFILE_CTYPE=() PLAN_PUTFILE_SHA=() PLAN_PUTFILE_SIZE=() PLAN_PUTFILE_FILE=() PLAN_PUTFILE_NCHUNKS=()
declare -a SKIPPED_PATHS=()

echo
echo "== scanning $BUILD_DIR =="
while IFS= read -r -d '' f; do
  relpath="${f#"$BUILD_DIR"/}"
  err=$(check_path_rules "$relpath" 2>&1) || { echo "ABORT: '$relpath' fails a DeWEB path rule ($err). See SPEC §6." >&2; exit 1; }
  size=$(stat -c%s "$f")
  if [ "$size" -gt 8400000 ]; then
    echo "ABORT: '$relpath' is $size bytes, over the 8,400,000-byte (350-chunk) DeWEB limit." >&2; exit 1
  fi
  sha=$(sha256sum "$f" | awk '{print $1}')
  ctype=$(mime_for "$relpath")

  info=$("$CAST" call "$SITEREG" "fileInfo(address,string)(uint32,string,bytes32,uint40,uint256)" "$CONTAINER" "$relpath" --rpc-url "$RPC")
  onchain_size=$(echo "$info" | sed -n 1p | num)
  onchain_sha=$(echo "$info" | sed -n 3p | sed 's/^0x//')
  onchain_chunks=$(echo "$info" | sed -n 5p | num)

  if [ "$onchain_chunks" != "0" ] && [ "$onchain_size" = "$size" ] && [ "$(echo "$onchain_sha" | tr 'A-F' 'a-f')" = "$sha" ]; then
    SKIPPED_PATHS+=("$relpath")
    continue
  fi
  nchunks=$(( (size + CHUNK_MAX - 1) / CHUNK_MAX ))
  [ "$nchunks" -eq 0 ] && nchunks=1
  PLAN_PUTFILE_PATH+=("$relpath"); PLAN_PUTFILE_CTYPE+=("$ctype"); PLAN_PUTFILE_SHA+=("0x$sha")
  PLAN_PUTFILE_SIZE+=("$size"); PLAN_PUTFILE_FILE+=("$f"); PLAN_PUTFILE_NCHUNKS+=("$nchunks")
done < <(find "$BUILD_DIR" -type f -print0)

echo "files unchanged (skip): ${#SKIPPED_PATHS[@]}"
echo "files to publish:       ${#PLAN_PUTFILE_PATH[@]}"

# --- Fallback plan ---------------------------------------------------------------------------
FALLBACK_PLANNED=0
if [ -n "$FALLBACK_PATH" ]; then
  current_fb=$("$CAST" call "$SITEREG" "fallbackPath(address)(string)" "$CONTAINER" --rpc-url "$RPC" | strip_quotes)
  [ "$current_fb" != "$FALLBACK_PATH" ] && FALLBACK_PLANNED=1
  echo "fallback: current='$current_fb' desired='$FALLBACK_PATH' -> $([ "$FALLBACK_PLANNED" = 1 ] && echo plan || echo "no change")"
fi

# --- Remove plan ------------------------------------------------------------------------------
declare -a REMOVE_PLANNED=()
for p in "${REMOVE_PATHS[@]:-}"; do
  [ -z "$p" ] && continue
  info=$("$CAST" call "$SITEREG" "fileInfo(address,string)(uint32,string,bytes32,uint40,uint256)" "$CONTAINER" "$p" --rpc-url "$RPC")
  chunks=$(echo "$info" | sed -n 5p | num)
  if [ "$chunks" = "0" ]; then
    echo "remove '$p': already absent, nothing to do"
  else
    REMOVE_PLANNED+=("$p")
    echo "remove '$p': planned"
  fi
done

# --- Bind plan ---------------------------------------------------------------------------------
BIND_VALUE_WEI=0
if [ -n "$BIND_NAME" ]; then
  case "$BIND_NAME" in *.tape) ;; *) BIND_NAME="$BIND_NAME.tape" ;; esac
  case "$BIND_MONTHS" in *[!0-9]*|"") echo "ABORT: --months must be a positive integer, got '$BIND_MONTHS'." >&2; exit 1 ;; esac
  if [ "$BIND_MONTHS" -lt 1 ] || [ "$BIND_MONTHS" -gt 120 ]; then
    echo "ABORT: --months must be 1-120, got $BIND_MONTHS." >&2; exit 1
  fi
  FEE_WEI=$("$CAST" call "$DOMBIND" "monthlyFee()(uint256)" --rpc-url "$RPC" | num)
  BIND_VALUE_WEI=$(python3 -c "print($BIND_MONTHS * $FEE_WEI)")
  LIVE_NOW=$("$CAST" call "$DOMBIND" "isLive(string,address)(bool)" "$BIND_NAME" "$CONTAINER" --rpc-url "$RPC")
  echo "bind '$BIND_NAME' for $BIND_MONTHS months: live now=$LIVE_NOW, monthlyFee=$FEE_WEI wei, msg.value=$BIND_VALUE_WEI wei"
fi

# --- Dry-run gas/cost estimate ----------------------------------------------------------------
GAS_PRICE_WEI=$("$CAST" gas-price --rpc-url "$RPC" | num)
# estimate()/fallback_estimate() are called as `g=$(fn ...)`, which forks a subshell - any
# mutation of a TOTAL_GAS *variable* inside them would be lost when the subshell exits. A file
# survives that, so gas numbers are appended here and summed once at the end instead.
GAS_LOG="$(mktemp)"
trap 'rm -f "$GAS_LOG" "${NONCE_FILE:-}"' EXIT
estimate() {
  # estimate <contract> <sig> <args...> -- prints gas, accumulates into TOTAL_GAS
  local contract="$1" sig="$2"; shift 2
  local args=() value=""
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--value" ]; then value="$2"; shift 2; else args+=("$1"); shift; fi
  done
  local extra=()
  [ -n "$FROM_ADDR" ] && extra+=(--from "$FROM_ADDR")
  [ -n "$value" ] && extra+=(--value "$value")
  local g
  g=$("$CAST" estimate "$contract" "$sig" "${args[@]}" "${extra[@]}" --rpc-url "$RPC" 2>&1) || {
    local argpreview
    argpreview=$(echo "${args[*]}" | head -c 120)
    echo "    WARN: gas estimate failed for $sig($argpreview...): $(echo "$g" | head -c 200) - using a flat 100000 gas placeholder, which may understate the real cost" >&2
    g=100000
  }
  echo "$g" | grep -qE '^[0-9]+$' || g=100000
  echo "$g" >> "$GAS_LOG"
  echo "$g"
}

# Fallback gas estimate for a not-yet-opened container: no real simulation is possible until the
# open() tx actually mines, which dry-run never does. Per TapeKit's own README ("each chunk is
# deployed as a small contract...roughly 200 gas per byte of deployed code plus overhead"), not a
# live chain read - labelled as such wherever used. Logged to $GAS_LOG like estimate().
fallback_estimate() {
  local nbytes="${1:-0}"
  local g=$(( 60000 + 200 * nbytes ))
  echo "$g" >> "$GAS_LOG"
  echo "$g"
}

# open() is payable with a protocol fee this contract has no public getter for. Discovered live by
# probing with --value 0: the contract reverts with FeeTooLow(uint256 sent, uint256 required)
# (selector 0xf04f3db2, confirmed live on 2026-11-18 against this exact call) - the fee is read
# from that revert's own data, not hardcoded. Falls back to the documented 0.08 OKB (proofdrop's
# real paid container-open fee) only if the probe's response shape ever changes.
discover_open_fee_wei() {
  local extra=() out data
  [ -n "$FROM_ADDR" ] && extra+=(--from "$FROM_ADDR")
  out=$("$CAST" estimate "$OPENER" "open(address,uint256)" "$PROCESSOR" "$TOKEN_ID" --value 0 "${extra[@]}" --rpc-url "$RPC" 2>&1) && { echo 0; return; }
  data=$(echo "$out" | grep -oE '0x[0-9a-fA-F]+' | head -1)
  if [ -n "$data" ] && [ "${data:0:10}" = "0xf04f3db2" ] && [ "${#data}" -ge 138 ]; then
    python3 -I -c "import sys; print(int(sys.argv[1][-64:], 16))" "$data" 2>/dev/null && return
  fi
  echo "    WARN: could not live-discover the open() fee from the revert; using the documented 0.08 OKB instead." >&2
  echo 80000000000000000
}

echo
echo "== dry-run plan =="
OPEN_FEE_WEI=0
if [ "$OPEN_PLANNED" = 1 ]; then
  OPEN_FEE_WEI=$(discover_open_fee_wei)
  g=$(estimate "$OPENER" "open(address,uint256)" "$PROCESSOR" "$TOKEN_ID" --value "$OPEN_FEE_WEI")
  echo "open container (fee $(python3 -c "print($OPEN_FEE_WEI/1e18)") OKB)         gas~$g"
fi
for i in "${!PLAN_PUTFILE_PATH[@]}"; do
  path="${PLAN_PUTFILE_PATH[$i]}"; ctype="${PLAN_PUTFILE_CTYPE[$i]}"; sha="${PLAN_PUTFILE_SHA[$i]}"
  file="${PLAN_PUTFILE_FILE[$i]}"; nchunks="${PLAN_PUTFILE_NCHUNKS[$i]}"; filesize="${PLAN_PUTFILE_SIZE[$i]}"
  first=$(chunk_hex "$file" 0 "$CHUNK_MAX")
  firstlen=$(( filesize < CHUNK_MAX ? filesize : CHUNK_MAX ))
  if [ "$OPEN_PLANNED" = 1 ]; then
    g=$(fallback_estimate "$firstlen")
    echo "putFile      $path (chunk 0/$nchunks)              gas~$g (fallback formula, see note above)"
  else
    g=$(estimate "$SITEREG" "putFile(address,string,string,bytes32,bytes)" "$CONTAINER" "$path" "$ctype" "$sha" "$first")
    echo "putFile      $path (chunk 0/$nchunks)              gas~$g"
  fi
  for ((c=1; c<nchunks; c++)); do
    off=$(( c * CHUNK_MAX ))
    chunklen=$(( filesize - off < CHUNK_MAX ? filesize - off : CHUNK_MAX ))
    chunk=$(chunk_hex "$file" "$off" "$CHUNK_MAX")
    if [ "$OPEN_PLANNED" = 1 ]; then
      g=$(fallback_estimate "$chunklen")
      echo "appendChunk  $path (chunk $c/$nchunks)              gas~$g (fallback formula)"
    else
      g=$(estimate "$SITEREG" "appendChunk(address,string,uint256,bytes)" "$CONTAINER" "$path" "$c" "$chunk")
      echo "appendChunk  $path (chunk $c/$nchunks)              gas~$g"
    fi
  done
done
if [ "$FALLBACK_PLANNED" = 1 ]; then
  if [ "$OPEN_PLANNED" = 1 ]; then
    g=$(fallback_estimate 0)
    echo "setFallback  $FALLBACK_PATH                                gas~$g (fallback formula)"
  else
    g=$(estimate "$SITEREG" "setFallback(address,string)" "$CONTAINER" "$FALLBACK_PATH")
    echo "setFallback  $FALLBACK_PATH                                gas~$g"
  fi
fi
for p in "${REMOVE_PLANNED[@]:-}"; do
  [ -z "$p" ] && continue
  g=$(estimate "$SITEREG" "removeFile(address,string)" "$CONTAINER" "$p")
  echo "removeFile   $p                                      gas~$g"
done
if [ -n "$BIND_NAME" ]; then
  g=$(estimate "$DOMBIND" "bind(string,address,uint256)" "$BIND_NAME" "$CONTAINER" "$BIND_MONTHS" --value "$BIND_VALUE_WEI")
  echo "bind         $BIND_NAME x${BIND_MONTHS}mo                         gas~$g"
fi

TOTAL_GAS=$(awk '{s+=$1} END{print s+0}' "$GAS_LOG")
GAS_COST_WEI=$(python3 -c "print(int($TOTAL_GAS * $GAS_PRICE_WEI))")
TOTAL_WEI=$(python3 -c "print($GAS_COST_WEI + $BIND_VALUE_WEI + $OPEN_FEE_WEI)")
TOTAL_OKB=$(python3 -c "print(f'{$TOTAL_WEI/1e18:.9f}')")
GAS_OKB=$(python3 -c "print(f'{$GAS_COST_WEI/1e18:.9f}')")
BIND_OKB=$(python3 -c "print(f'{$BIND_VALUE_WEI/1e18:.9f}')")
OPEN_FEE_OKB=$(python3 -c "print(f'{$OPEN_FEE_WEI/1e18:.9f}')")

echo
echo "total estimated gas: $TOTAL_GAS @ $GAS_PRICE_WEI wei/gas = $GAS_OKB OKB"
[ "$OPEN_FEE_WEI" != "0" ] && echo "container-open fee (msg.value, not gas): $OPEN_FEE_OKB OKB"
[ "$BIND_VALUE_WEI" != "0" ] && echo "domain-binding fee (msg.value, not gas): $BIND_OKB OKB"
echo "ESTIMATED TOTAL: $TOTAL_OKB OKB"
if [ -n "$FROM_ADDR" ]; then
  BAL_WEI=$("$CAST" balance "$FROM_ADDR" --rpc-url "$RPC" 2>/dev/null | num || echo "")
  if [ -n "$BAL_WEI" ]; then
    BAL_OKB=$(python3 -c "print(f'{$BAL_WEI/1e18:.9f}')")
    if python3 -c "exit(0 if $BAL_WEI < $TOTAL_WEI else 1)"; then
      echo "WARNING: $FROM_ADDR currently holds $BAL_OKB OKB, which is LESS than the $TOTAL_OKB OKB estimated above. Fund it before --broadcast."
    else
      echo "wallet $FROM_ADDR currently holds $BAL_OKB OKB (enough for this estimate)."
    fi
  fi
fi

# --- tape:// name resolution (optional, slow, cached) ------------------------------------------
NAME_OUT=""
if [ "$RESOLVE_NAME" = 1 ] && [ -n "$PROCESSOR" ]; then
  CACHE="$(dirname "$MANIFEST")/.deweb-cpu-cache.json"
  CPU_NUM=$(python3 -I -c "
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
print(d.get(sys.argv[2].lower(), ''))
" "$CACHE" "$PROCESSOR" 2>/dev/null || true)
  if [ -z "$CPU_NUM" ]; then
    echo
    echo "resolving processor number (one-time, scans the factory's cpu list - be patient)..."
    COUNT=$("$CAST" call "$FACTORY" "cpuCount()(uint256)" --rpc-url "$RPC" | num)
    for ((i=0; i<COUNT; i++)); do
      a=$("$CAST" call "$FACTORY" "cpuAt(uint256)(address)" "$i" --rpc-url "$RPC")
      if [ "$(echo "$a" | tr 'A-F' 'a-f')" = "$(echo "$PROCESSOR" | tr 'A-F' 'a-f')" ]; then CPU_NUM="$i"; break; fi
      sleep 0.05
    done
    if [ -n "$CPU_NUM" ]; then
      python3 -I -c "
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
d[sys.argv[2].lower()] = sys.argv[3]
json.dump(d, open(sys.argv[1], 'w'))
" "$CACHE" "$PROCESSOR" "$CPU_NUM"
    fi
  fi
  if [ -n "$CPU_NUM" ]; then
    NAME_OUT="${TOKEN_ID}.2.${CPU_NUM}.tape"
    echo "tape:// name: $NAME_OUT  (gateway: https://${TOKEN_ID}-2-${CPU_NUM}.tapekit.org/)"
  else
    echo "could not resolve a processor number within $COUNT entries (factory may have grown; re-run --resolve-name)"
  fi
fi

# --- Write manifest (dry-run version) -----------------------------------------------------------
write_manifest() {
  python3 -I -c "
import json, sys, datetime
data = {
    'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'chainId': $CHAIN_ID,
    'rpc': '$RPC',
    'container': '$CONTAINER',
    'processor': '${PROCESSOR:-}' or None,
    'tokenId': ${TOKEN_ID:-None},
    'tapeName': '${NAME_OUT:-}' or None,
    'broadcast': $BROADCAST,
    'estimatedTotalOkb': '$TOTAL_OKB',
    'estimatedGas': $TOTAL_GAS,
    'gasPriceWei': $GAS_PRICE_WEI,
    'skipped': json.loads(sys.argv[1]),
    'published': json.loads(sys.argv[2]),
    'fallback': json.loads(sys.argv[3]),
    'removed': json.loads(sys.argv[4]),
    'bind': json.loads(sys.argv[5]),
}
json.dump(data, open('$MANIFEST', 'w'), indent=2)
print('wrote $MANIFEST')
" \
    "$(printf '%s\n' "${SKIPPED_PATHS[@]:-}" | python3 -I -c "import json,sys; print(json.dumps([l for l in sys.stdin.read().split(chr(10)) if l]))")" \
    "$1" "$2" "$3" "$4"
}

if [ "$BROADCAST" -eq 0 ]; then
  echo
  echo "Dry run only - nothing was sent. Re-run with --broadcast to actually publish (will ask for a typed confirmation first)."
  PUB_JSON=$(python3 -I -c "
import json,sys
paths = sys.argv[1].split(chr(10)) if sys.argv[1] else []
print(json.dumps([{'path': p, 'status': 'planned'} for p in paths if p]))
" "$(printf '%s\n' "${PLAN_PUTFILE_PATH[@]:-}")")
  FB_JSON=$([ "$FALLBACK_PLANNED" = 1 ] && echo "{\"path\": \"$FALLBACK_PATH\", \"status\": \"planned\"}" || echo "null")
  RM_JSON=$(python3 -I -c "
import json,sys
paths = sys.argv[1].split(chr(10)) if sys.argv[1] else []
print(json.dumps([{'path': p, 'status': 'planned'} for p in paths if p]))
" "$(printf '%s\n' "${REMOVE_PLANNED[@]:-}")")
  BIND_JSON=$([ -n "$BIND_NAME" ] && echo "{\"name\": \"$BIND_NAME\", \"months\": $BIND_MONTHS, \"valueWei\": $BIND_VALUE_WEI, \"status\": \"planned\"}" || echo "null")
  write_manifest "$PUB_JSON" "$FB_JSON" "$RM_JSON" "$BIND_JSON"
  exit 0
fi

# --- Broadcast ------------------------------------------------------------------------------
if [ -z "${KEYSTORE_ACCOUNT:-}" ] && [ -z "${KEY_FILE:-}" ]; then
  echo "Set KEYSTORE_ACCOUNT or KEY_FILE (never a raw private key on this command line)." >&2
  exit 1
fi
SIGNER_ARGS=()
[ -n "${KEYSTORE_ACCOUNT:-}" ] && SIGNER_ARGS=(--account "$KEYSTORE_ACCOUNT") || SIGNER_ARGS=(--keystore "$KEY_FILE")
[ -n "${FORGE_PASSWORD_FILE:-}" ] && SIGNER_ARGS+=(--password-file "$FORGE_PASSWORD_FILE")

echo
echo "=== BROADCAST CONFIRMATION REQUIRED ==="
echo "Type the exact total OKB shown above ($TOTAL_OKB), then press enter:"
read -r TYPED_COST
[ "$TYPED_COST" = "$TOTAL_OKB" ] || { echo "Cost did not match. Aborting." >&2; exit 1; }
echo "Type the exact container address ($CONTAINER), then press enter:"
read -r TYPED_ADDR
[ "$TYPED_ADDR" = "$CONTAINER" ] || { echo "Address did not match. Aborting." >&2; exit 1; }
echo "Type the exact chain id ($CHAIN_ID), then press enter:"
read -r TYPED_CHAIN
[ "$TYPED_CHAIN" = "$CHAIN_ID" ] || { echo "Chain id did not match. Aborting." >&2; exit 1; }

DEPLOYER=$("$CAST" wallet address "${SIGNER_ARGS[@]}" 2>/dev/null) || { echo "ABORT: could not resolve signer address." >&2; exit 1; }
FROM_BLOCK=$("$CAST" block-number --rpc-url "$RPC" 2>/dev/null || echo 0)
FROM_BLOCK=$(( FROM_BLOCK > 5 ? FROM_BLOCK - 5 : 0 ))
START_NONCE=$("$CAST" nonce "$DEPLOYER" --rpc-url "$RPC")
# send_idempotent is always called as `TX=$(send_idempotent ...)`, which forks a subshell - a
# plain `NONCE=$((NONCE+1))` inside it would be lost the instant that subshell exits (the exact
# bug class already fixed for TOTAL_GAS/GAS_LOG above). A file survives across that fork, so the
# next nonce lives there instead of in a shell variable. Real incident this guards against: the
# very first live run of this script DID hit this bug - open() correctly used nonce 54, but the
# lost increment meant putFile's send also tried nonce 54, which the chain rightly rejected
# ("next nonce 55, tx nonce 54") since open() had already consumed it. Nothing was lost (open()
# itself is idempotent via isOpened()), but it's exactly why this file-based fix exists.
NONCE_FILE="$(mktemp)"
echo "$START_NONCE" > "$NONCE_FILE"

# Idempotent recovery: after any send, re-read the exact on-chain state we were trying to set.
# If it already matches, treat as success even if the send itself errored or timed out - safer
# than event scanning here, and it's the same check the skip-unchanged logic already does.
send_idempotent() {
  local label="$1" check_cmd="$2"; shift 2
  local nonce out rc hash
  nonce=$(cat "$NONCE_FILE")
  out=$("$CAST" send "$@" --async --nonce "$nonce" --rpc-url "$RPC" 2>&1); rc=$?
  hash=$(echo "$out" | grep -oE '0x[0-9a-fA-F]{64}' | head -1)
  if [ "$rc" -ne 0 ] || [ -z "$hash" ]; then
    echo "WARN [$label]: send errored ($(echo "$out" | head -1 | cut -c1-160)). Checking on-chain state before giving up." >&2
    if eval "$check_cmd"; then
      echo "RECOVERED [$label]: on-chain state already matches - treating as success." >&2
      echo "$((nonce + 1))" > "$NONCE_FILE"
      echo "unknown(recovered)"; return 0
    fi
    echo "ABORT [$label]: send failed and on-chain state does not match." >&2
    return 1
  fi
  echo "$((nonce + 1))" > "$NONCE_FILE"
  wait_tx_status "$hash" "${TX_WAIT_TRIES:-30}"; rc=$?
  if [ "$rc" -eq 0 ]; then echo "$hash"; return 0; fi
  if [ "$rc" -eq 1 ]; then echo "ABORT [$label]: tx $hash mined but reverted." >&2; echo "$hash"; return 1; fi
  if eval "$check_cmd"; then echo "RECOVERED [$label]: receipt stayed unknown but on-chain state already matches." >&2; echo "$hash"; return 0; fi
  echo "ABORT [$label]: tx $hash unconfirmed and on-chain state does not match." >&2; echo "$hash"; return 2
}

declare -a PUB_RESULT=()

if [ "$OPEN_PLANNED" = 1 ]; then
  echo "Opening container..."
  check="[ \"\$(\"$CAST\" call \"$OPENER\" \"isOpened(address,uint256)(bool)\" \"$PROCESSOR\" \"$TOKEN_ID\" --rpc-url \"$RPC\")\" = true ]"
  TX=$(send_idempotent open "$check" "$OPENER" "open(address,uint256)" "$PROCESSOR" "$TOKEN_ID" --value "$OPEN_FEE_WEI" "${SIGNER_ARGS[@]}") || { echo "ABORT: could not open container. Stopping before any file writes." >&2; exit 1; }
  echo "open tx: $TX"
fi

for i in "${!PLAN_PUTFILE_PATH[@]}"; do
  path="${PLAN_PUTFILE_PATH[$i]}"; ctype="${PLAN_PUTFILE_CTYPE[$i]}"; sha="${PLAN_PUTFILE_SHA[$i]}"
  file="${PLAN_PUTFILE_FILE[$i]}"; nchunks="${PLAN_PUTFILE_NCHUNKS[$i]}"
  first=$(chunk_hex "$file" 0 "$CHUNK_MAX")
  echo "Publishing $path (chunk 0/$nchunks)..."
  check="[ \"\$(\"$CAST\" call \"$SITEREG\" \"fileInfo(address,string)(uint32,string,bytes32,uint40,uint256)\" \"$CONTAINER\" \"$path\" --rpc-url \"$RPC\" | sed -n 3p | tr 'A-F' 'a-f')\" = \"${sha}\" ]"
  TX=$(send_idempotent "putFile $path" "$check" "$SITEREG" "putFile(address,string,string,bytes32,bytes)" "$CONTAINER" "$path" "$ctype" "$sha" "$first" "${SIGNER_ARGS[@]}") || { echo "ABORT: putFile failed for $path. Stopping (safe to re-run: unaffected files will be skipped)." >&2; exit 1; }
  echo "  tx: $TX"
  for ((c=1; c<nchunks; c++)); do
    off=$(( c * CHUNK_MAX ))
    chunk=$(chunk_hex "$file" "$off" "$CHUNK_MAX")
    echo "Publishing $path (chunk $c/$nchunks)..."
    ccheck="[ \"\$(\"$CAST\" call \"$SITEREG\" \"fileInfo(address,string)(uint32,string,bytes32,uint40,uint256)\" \"$CONTAINER\" \"$path\" --rpc-url \"$RPC\" | sed -n 5p | awk '{print \$1}')\" -ge $((c+1)) ]"
    TX=$(send_idempotent "appendChunk $path#$c" "$ccheck" "$SITEREG" "appendChunk(address,string,uint256,bytes)" "$CONTAINER" "$path" "$c" "$chunk" "${SIGNER_ARGS[@]}") || { echo "ABORT: appendChunk failed for $path chunk $c. Stopping (safe to re-run: putFile already wrote chunk 0, so this resumes, it doesn't duplicate)." >&2; exit 1; }
    echo "  tx: $TX"
  done
  PUB_RESULT+=("{\"path\": \"$path\", \"status\": \"published\"}")
done

FB_RESULT="null"
if [ "$FALLBACK_PLANNED" = 1 ]; then
  echo "Setting fallback to $FALLBACK_PATH..."
  check="[ \"\$(\"$CAST\" call \"$SITEREG\" \"fallbackPath(address)(string)\" \"$CONTAINER\" --rpc-url \"$RPC\")\" = '\"$FALLBACK_PATH\"' ]"
  TX=$(send_idempotent setFallback "$check" "$SITEREG" "setFallback(address,string)" "$CONTAINER" "$FALLBACK_PATH" "${SIGNER_ARGS[@]}") || { echo "ABORT: setFallback failed." >&2; exit 1; }
  echo "  tx: $TX"
  FB_RESULT="{\"path\": \"$FALLBACK_PATH\", \"status\": \"published\", \"tx\": \"$TX\"}"
fi

declare -a RM_RESULT=()
for p in "${REMOVE_PLANNED[@]:-}"; do
  [ -z "$p" ] && continue
  echo "Removing $p..."
  check="[ \"\$(\"$CAST\" call \"$SITEREG\" \"fileInfo(address,string)(uint32,string,bytes32,uint40,uint256)\" \"$CONTAINER\" \"$p\" --rpc-url \"$RPC\" | sed -n 5p | awk '{print \$1}')\" = 0 ]"
  TX=$(send_idempotent "removeFile $p" "$check" "$SITEREG" "removeFile(address,string)" "$CONTAINER" "$p" "${SIGNER_ARGS[@]}") || { echo "ABORT: removeFile failed for $p." >&2; exit 1; }
  echo "  tx: $TX"
  RM_RESULT+=("{\"path\": \"$p\", \"status\": \"removed\", \"tx\": \"$TX\"}")
done

BIND_RESULT="null"
if [ -n "$BIND_NAME" ]; then
  echo "Binding $BIND_NAME for $BIND_MONTHS months ($BIND_OKB OKB)..."
  check="\"$CAST\" call \"$DOMBIND\" \"isLive(string,address)(bool)\" \"$BIND_NAME\" \"$CONTAINER\" --rpc-url \"$RPC\" | grep -q true"
  TX=$(send_idempotent bind "$check" "$DOMBIND" "bind(string,address,uint256)" "$BIND_NAME" "$CONTAINER" "$BIND_MONTHS" --value "$BIND_VALUE_WEI" "${SIGNER_ARGS[@]}") || { echo "ABORT: bind failed." >&2; exit 1; }
  echo "  tx: $TX"
  BIND_RESULT="{\"name\": \"$BIND_NAME\", \"months\": $BIND_MONTHS, \"valueWei\": $BIND_VALUE_WEI, \"status\": \"published\", \"tx\": \"$TX\"}"
fi

PUB_JSON="[$(IFS=,; echo "${PUB_RESULT[*]:-}")]"
RM_JSON="[$(IFS=,; echo "${RM_RESULT[*]:-}")]"
write_manifest "$PUB_JSON" "$FB_RESULT" "$RM_JSON" "$BIND_RESULT"
echo
echo "Done. $([ -n "$NAME_OUT" ] && echo "Site: https://$(echo "$NAME_OUT" | sed 's/\.tape$//' | tr '.' '-').tapekit.org/")"
