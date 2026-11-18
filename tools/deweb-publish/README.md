# deweb-publish

A generic publisher for [TapeKit](https://github.com/TapeOutProtocol/TapeKit) DeWEB sites on X
Layer mainnet (chain 196). Point it at any static build folder and any TapeOut circuit NFT's
container, and it writes the site directly to the real `SiteRegistry` contract - no hosted
console, no off-chain server.

Not specific to any one project. It's published here alongside Forgeout because no open-source
DeWEB publishing CLI exists yet (TapeKit's own README lists one as "on the roadmap" as of its
2026-09-18 entry) - this fills that gap for the wider TapeOut ecosystem, not just this repo.

## What it does

- Opens a circuit's container if it isn't open yet (`ContainerOpener.open`, which is payable - the
  fee has no public getter, so the tool discovers it live by reading the revert data of a 0-value
  probe call, rather than hardcoding a number that could go stale).
- Walks a build folder, hashes every file (SHA-256), and diffs against what's already on-chain
  (`SiteRegistry.fileInfo`) so re-running the tool only republishes what actually changed.
- Chunks anything over 24,000 bytes and writes it with `putFile` + `appendChunk`, exactly as
  TapeKit's SPEC Appendix B.5 describes.
- Can set the SPA fallback path (`setFallback`), remove paths (`removeFile`), and bind/renew a
  `tape://` name (`DomainBinding.bind`, fee read live via `monthlyFee()`).
- `--dry-run` (the default - nothing is ever sent unless you pass `--broadcast`) prints a full
  gas/OKB estimate per call and the live balance of the signing address, and writes
  `deweb-manifest.json`.
- Every write is signed only through a Foundry keystore account or key file - **never** a raw
  `--private-key` on the command line, matching the rest of this repo's safety model
  (`scripts/tapeout.sh`, `scripts/go-live.sh`).

## Usage

```bash
# Derive the container from a processor + circuit NFT id (opens it automatically if needed):
tools/deweb-publish/deweb-publish.sh ./dist --processor 0x57F3...Aa355 --token-id 6

# Or target an already-opened container directly (generic path, any container):
tools/deweb-publish/deweb-publish.sh ./dist --container 0x43Eb...56956 --from 0xYourAddress

# Set the SPA fallback, bind a name for 12 months, and actually publish:
KEYSTORE_ACCOUNT=my-key tools/deweb-publish/deweb-publish.sh ./dist \
  --processor 0x57F3...Aa355 --token-id 6 \
  --fallback index.html --bind 6.2.272 --months 12 \
  --broadcast
```

Full flag list and contract addresses are documented at the top of `deweb-publish.sh`.

## Why `--dry-run` can't always give a live gas number

A container that hasn't been opened yet doesn't exist on-chain, so there is nothing to simulate
`putFile`/`appendChunk`/`setFallback` against until the `open()` transaction actually mines - which
a dry run never does. For that case the tool falls back to TapeKit's own documented formula
("each chunk is deployed as a small contract...roughly 200 gas per byte of deployed code plus
overhead") and labels every such line `(fallback formula)` so it's never confused with a real
chain read. Once a container is open, every estimate is a live `eth_estimateGas` call.

## Safety notes this tool inherits from the rest of the repo

- `--broadcast` always asks for a typed confirmation of the exact total OKB, the container
  address, and the chain id before sending anything.
- Re-running after a partial failure is safe: `putFile` already replaces-if-exists, chunk writes
  are idempotent by construction (`expectIndex` is checked on-chain), and this tool additionally
  re-reads on-chain state after any send error before deciding whether to report failure - the
  same check the skip-unchanged logic already does, not a separate guess.
- `deweb-manifest.json` records container/processor/tokenId, the resolved `tape://` name (if
  `--resolve-name` was used), every file's planned-or-published status, and the real tx hash for
  anything actually sent.

## Known limitations

- `--resolve-name` (computing the human-readable `<#ID>.2.<processor number>.tape` name) requires
  scanning the factory's processor list (`cpuAt(0..cpuCount()-1)`, append-only, no reverse lookup
  exists on-chain) and is `O(cpuCount)` - slow the first time for a given processor, cached
  afterward in `<manifest-dir>/.deweb-cpu-cache.json`. Off by default.
- Gas estimates (and the fallback formula) are estimates, not guarantees; `--broadcast` re-checks
  live state before and after every send regardless.
