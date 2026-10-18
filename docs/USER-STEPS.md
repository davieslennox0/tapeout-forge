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

Pick circuits from the 22 real beats (apps/web's gallery, or `forge replay`). For each, get the
real calldata:
```
forge calldata <netlist.hex> --nin N --nout M
```
This requires Foundry's `cast` on PATH and never sends anything itself - it only prints
calldata. To actually send it, use `cast send` (or your own signer) against the real processor
with that calldata and the real fee in OKB (docs/TAPEOUT-DRYRUN.md: tape-out fee 0.0013 OKB +
mint cost ~0.0001 OKB/transistor + 0.00066 OKB protocol fee per circuit - see that doc's table
for the real per-circuit totals, e.g. task 12: 0.00756 OKB all-in).

**What could go wrong**: the transistor-mint step was found to depend on your account having NO
unusual on-chain code (docs/NEW.md's EIP-7702-delegation finding) - a plain funded EOA is fine,
but if your deploying key is itself a smart-contract wallet or has a delegation set, check it
mints successfully on a fork FIRST. Also: minting consumes real transistors with a real supply
cap (10,000 at last check, 42 already minted) - if many teams tape out at once this could run
out; check `transistors().minted()`/`supplyCap()` live before committing.

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
