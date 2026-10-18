# 3.0 — DeWEB / TapeKit publish-flow research (before building apps/web)

Sources (official, read directly, not from memory):
- github.com/TapeOutProtocol/TapeKit README (fetched via `gh api repos/TapeOutProtocol/TapeKit/readme`, spec v0.2, dated 2026-09-13/17/18 updates)

## VERIFIED facts

- TapeKit/`tape://` is real and does cover X Layer (chainId 196), not just BNB Smart Chain. Name format on X Layer: `<#ID>.2.<processor>` (area code 2), e.g. `1.2.0.tape`.
- X Layer contract addresses (same deployer, same order as BNB, per README): Processor factory `0x1f09DAeFA827f02CBb40967cc91b259763760761`; Container opener `0x536adD8F30f03b69f6fbF29d425A816A0dC50106`; SiteRegistry (proxy) `0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6`; DomainBinding (proxy) `0x68809Fd2fb343aA57D0aeB7f33Defe477c9666f9`.
- A DeWEB site is bound to a **TapeOut circuit NFT's container** (ERC-6551 account). Prerequisite chain, in order: own a circuit NFT on some processor -> open its container (via the container opener contract; the hosted "HashPort console" does this for you) -> write files under it.
- Publishing: either (A) the hosted HashPort console (wallet-signed, handles hashing/chunking), or (B) direct contract calls anyone can script: `putFile(container, path, contentType, sha256, firstChunk<=24000B)` (replaces if exists), `appendChunk(container, path, expectIndex, chunk)` per 24,000-byte chunk, optional `setFallback(container, path)` for SPA routing, `removeFile(container, path)`.
- **No open-source publishing CLI exists yet** — README explicitly lists it as "on the roadmap." Today it's the hosted console or a hand-written script against the documented contract calls.
- Limits: 24,000B/chunk, 8,400,000B (350 chunks) max file size, 5,000 paths listed per client call, 32MB/2,000-file preread cap in the sandboxed preview viewer only (the live gateway has no such cap).
- Static-site requirements: plain static folder, `index.html` at root, **relative paths only** (no absolute `https://` to your own files), NFC-normalized filenames, correct MIME type per file (anything non-standard is served as `application/octet-stream` and won't execute/render).
- A "100% on-chain" badge (optional, not required for the hackathon) requires zero off-chain references/fetches anywhere (no external fonts/CDNs/analytics, no runtime `fetch`/`XHR` to off-chain hosts).
- TapeSend (the DeWEB messaging layer) is explicitly **live on BNB Smart Chain only** so far; its X Layer deployment status isn't stated. Irrelevant to a static site (messaging ≠ hosting), but don't claim it's live on X Layer.
- Not independently audited (README's own words, as of the 2026-09-18 entry).

## UNVERIFIED / explicitly out of scope for this phase

- Nothing about actually publishing was left ambiguous by the docs — the gap is that doing it for real requires owning a circuit NFT + an opened container + a signed transaction with a real key, which this phase's rules forbid (no transactions on any real chain). That's why actual publishing is written as a maintainer-run step in docs/USER-STEPS.md, not done here.

## Decision this drives

apps/web is built as an ordinary static site (Vite/plain static build, no server) that already satisfies the relative-path/MIME/NFC constraints above, so it is DeWEB-publishable later without changes — but it is NOT published to DeWEB in this phase (no NFT owned, no transaction sent). Per BUILD.md section 2, DeWEB integration is explicitly "none required" for the hackathon submission, so this is a bonus-track capability, not a blocker.
