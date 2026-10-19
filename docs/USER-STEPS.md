# User steps (BUILD.md 3.6) - for the maintainer, with their own key, their own money

Nothing in this repo has sent a real transaction. Everything below is a manual action for the
project owner to run deliberately, in order. Each step says what could realistically go wrong.

## 1. Deploy ForgeRegistry to X Layer mainnet

```
forge create contracts/src/ForgeRegistry.sol:ForgeRegistry --rpc-url https://rpc.xlayer.tech --private-key $YOUR_KEY
```
Expected gas: deployment itself was not separately measured (only on-chain *verification calls*
were measured, docs/GAS-VERIFY.md: n=3 -> 342,856; n=4 -> 690,567; n=5 -> 2,190,727;
n=6 -> 7,556,637 gas per verify call). Measure the deployment's own gas on a fork first
(`forge create --rpc-url https://rpc.xlayer.tech --private-key $YOUR_KEY --dry-run` or a local
anvil fork) before sending for real - don't assume it matches a verify call's cost.

**What could go wrong**: X Layer's real block gas limit is 210,000,000 (BUILD.md/docs/GAS-VERIFY.md)
so even n=6 verification (7.5M gas) fits with huge headroom - the real risk is gas *price*
volatility on the day, not the limit. Record the deployed address immediately in
`config/chains.ts` or wherever the team keeps live addresses, and in docs/SUBMISSION.md's
"Addresses" TODO - a registry nobody can find is useless.

## 2. Tape out the chosen circuits

Final list (Phase 7): GC-012, GC-037, GC-050, GC-039, GC-046 — all re-confirmed strictly
better than reference. Get the real calldata:
```
forge calldata <netlist.hex> --nin N --nout M
```
This requires Foundry's `cast` on PATH and never sends anything itself - it only prints
calldata. Real fees are in **docs/COSTS.md**, now priced against **OrderGuard**
(`0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`) - FAB_TST's own pricing (further down in the
same doc) is kept for history but is SUPERSEDED: Phase 6 found FAB_TST's transistor supply
exhausted with no acquisition route (docs/ACQUIRE-AND-CLAIM.md), so Phase 7 retargeted go-live
to OrderGuard, which has real headroom. Total for all 5: 0.0447 OKB, 349 transistors (well
within OrderGuard's 9,958 available).

**What could go wrong**: the transistor-mint step was found to depend on your account having NO
unusual on-chain code (docs/NEW.md's EIP-7702-delegation finding) - a plain funded EOA is fine,
but if your deploying key is itself a smart-contract wallet or has a delegation set, check it
mints successfully on a fork FIRST.

**Transistor supply - two DIFFERENT contracts, don't mix the numbers up**: FAB_TST's own
transistor contract (which is the SAME contract as the FAB-Genesis NFT, `0xBe6f...eb714`) has
`supplyCap()==minted()==1,000,000` - **exhausted**, confirmed live, and is NOT used by this
plan. OrderGuard has its own SEPARATE transistor contract (`0x8e71...9D9e`) with cap 10,000 /
42 minted (plenty of headroom) - this is the one scripts/tapeout.sh actually targets now.

## 3. Register the taped-out circuits in ForgeRegistry

Call `ForgeRegistry.submit(...)` (see contracts/src/ForgeRegistry.sol for the exact signature)
with the processor address, the real circuit ID you just minted, gates, depth, and a proof hash
from `checkEquivalence`. The contract only accepts a strictly-better verified circuit per
specHash, so submit your best one first to avoid a wasted transaction.

**What could go wrong**: if someone else has already registered a better circuit for the same
specHash since you last checked, your submission reverts - re-run `forge optimize` against the
live registry state right before submitting, not against a stale local run.

## 4. Publish apps/web on DeWEB (optional - see README's DeWEB section)

Requires: your own TapeOut circuit NFT on X Layer, its container opened via the container
opener (`0x536adD8F30f03b69f6fbF29d425A816A0dC50106`), then either the hosted HashPort console
or direct `putFile`/`appendChunk` calls to SiteRegistry (`0xd6EFb7adCc9c83dC4924Ad56f6a8E4e969b9ADB6`)
with `apps/web/dist`'s contents (docs/DEWEB-RESEARCH.md has the full constraints: relative
paths, NFC filenames, 24,000-byte chunks, 8.4MB/file cap).

**What could go wrong**: there is no open-source publishing CLI yet (confirmed in
docs/DEWEB-RESEARCH.md) - you're either using the hosted console or hand-rolling the chunked
upload; a wrong content-type on `index.html`/the JS bundle makes the browser refuse to run the
site, with no error beyond a blank page. Test by resolving `your-name.2.<processor>.tape`
yourself before announcing it.

## 4a. apps/web is already live (plain static hosting, not DeWEB)

Already done, not a remaining TODO: https://forge.fanside.xyz is live right now, serving the
same `apps/web/dist` build via a normal Caddy static site (not DeWEB — DeWEB is still the
optional step 4 above). Repeatable/updatable with:
```
scripts/deploy-web.sh forge.fanside.xyz /var/www/forge /etc/caddy/Caddyfile
```
This builds, backs up the Caddyfile, copies the build output, adds/validates the site block,
checks DNS, and only then reloads Caddy — it stops before reloading if DNS doesn't resolve yet,
and restores the backup if validation fails. No secrets in the script; it must be run on the
target host itself (it does not SSH anywhere).

**What could go wrong**: it edits the live Caddyfile on whatever host you run it on — only run
it on a host you intend to actually serve from. It `--delete`s the target webroot's contents on
each run (rsync mirrors the build output exactly), so don't point `<webroot>` at a directory
with anything else in it.

## 4b. REVEAL_NETLISTS: netlist/calldata are hidden from the public build by default

apps/web/src/data/gallery.full.json holds the real netlist hex + calldata for all 22 beats;
apps/web/src/data/gallery.json (gitignored, regenerated every build by
apps/web/scripts/redact-gallery.mjs) is what actually ships. Default build
(REVEAL_NETLISTS unset or anything but "true") strips netlistHex/calldata entirely before
Vite even sees them - verified by grepping the real built dist/ output for the actual hex
strings of two real circuits (GC-012, GC-046): zero matches either field. The gallery still
shows task/name/in-out/reference-C/our-C/q; the copy buttons are replaced with "Published
after tape-out".

To reveal them (only do this AFTER a circuit is actually taped out, so publishing the netlist
can no longer let someone else front-run submitting it first):
```
REVEAL_NETLISTS=true pnpm --filter @forgeout/web build
scripts/deploy-web.sh forge.fanside.xyz /var/www/forge /etc/caddy/Caddyfile
```
**What could go wrong**: forgetting REVEAL_NETLISTS=true on a later rebuild silently
re-redacts a previously-revealed site (the flag is not persisted anywhere, it is read fresh at
each build) - if you deploy a revealed version, note it down so you do not accidentally revert.

## 5. Make the repo public

```
gh repo edit davieslennox0/tapeout-forge --visibility public --accept-visibility-change-consequences
```
**What could go wrong**: the repo currently contains only this project's own work (checked
against docs/REUSED.md) - but re-check for anything you added locally and never meant to share
(stray `.env`, local notes) before flipping visibility; once public, anything in git history
stays recoverable even if you delete the file in a later commit. Do this step last, right
before or at submission time, not early - a half-finished public repo invites premature
scrutiny with no upside.
