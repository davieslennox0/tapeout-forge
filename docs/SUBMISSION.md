# Submission draft (BUILD.md 3.4)

Per BUILD.md section 2 (VERIFIED from the official X Layer TapeOut Accelerate page): description
must cover product, target users and how to reach them, revenue model, why users would pay and
keep using it; demo video up to 3 minutes; must provide addresses/access link and the TapeOut
features used.

## Product

Forgeout: a compiler/optimizer/equivalence-checker for TapeOut circuits on X Layer. Given a
boolean spec, an existing netlist, or a FabX task reference, it returns the cheapest or
shallowest provably-equivalent NAND/LATCH circuit with an independently-verified equivalence
proof, and can register the result on-chain or build a (dry-run) tape-out submission. It is
infrastructure for other TapeOut builders, not a consumer app (BUILD.md section 1).

## Target users and how to reach them

Circuit builders and FabX Proof-of-Design miners on X Layer, reached through the FabX/TapeOut
Discord and the public task-bank community where a "beats the reference" claim is directly
checkable; contracts that depend on a circuit and want a checkable equivalence proof before
trusting it with funds; processor creators as ecosystem partners, since a shared registry of
best-known circuits means more tape-out volume for them.

## Revenue model (UNVALIDATED - BUILD.md section 5)

No pricing or paying users yet; needs at least one real builder conversation before relying on
this. Candidate value, since a one-off optimization has little standalone pricing power once
many people have the tool (public vectors, winner-take-the-bonus scoring): batch coverage/speed
across all 100 tasks, monitoring for new tasks or beaten incumbents, registry listings, a paid
API/CI tier for large circuits, and a watchtower/challenge service if FabX's challenge mechanism
turns out to be rewarded (currently UNKNOWN).

## Why users would pay and keep using it

Verification and headroom are the product, not raw gas savings (X Layer gas is cheap - BUILD.md
section 1 explicitly says not to claim large gas savings as the value). A wrong "my circuit is
equivalent" claim costs real money once funds depend on it (a vault, a policy processor); FabX's
winner-take-the-bonus scoring means a beaten incumbent needs to find out fast, not guess, and
keeps coming back as the task bank and the field of competing circuits change over time.

## TapeOut ecosystem features used

- TapeOut circuits/contracts on X Layer, chain 196: read-only `eval()`/`circuitInfo`/`netlist`
  calls against the real deployed processor `0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`
  (OrderGuard) and live FabX circuit IDs (e.g. id=65, id=49) - see docs/NEW.md and
  packages/chain/test/chain.test.ts for the real on-chain reads this project makes.
- FabX Proof-of-Design task bank and scoring formula (api.fabx.tech) - the entire replay
  (docs/FABX-REPLAY.md) is built from FabX's own real task bank and real fetched vectors.
- DeWEB/TapeKit: researched (docs/DEWEB-RESEARCH.md), not deployed - optional per BUILD.md
  section 2 ("none required"). apps/web's static build already satisfies DeWEB's publish
  constraints so it could be published later without changes.
- ForgeRegistry (contracts/ForgeRegistry.sol): built, ABI-verified against the real processor,
  tested on a live X Layer fork - not yet deployed to the real chain (see TODO below).
- Silicon export (docs/SILICON.md): `forge export-silicon` generates a real Tiny Tapeout
  `ttsky`-shaped repo directory from a netlist. One real circuit (task 12, GC-012) has been run
  all the way through Tiny Tapeout's own GitHub Actions CI for real - synthesis and DRC both
  passed (15/15 precheck checks), producing a real 34-cell GDS. Status never exceeds "exported" -
  no ordering, no payment, no shuttle submission. See docs/SILICON.md for the exact wording and
  limits.

## Addresses

- Processor used for all on-chain verification: `0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`
  (OrderGuard, X Layer, chain 196) - VERIFIED, real reads throughout this project.
- FAB-Genesis NFT: `0xBe6f94115D32f3AC3252bc4626573e739bEeb714` - VERIFIED (BUILD.md section 3).
- ForgeRegistry: **TODO - not yet deployed to X Layer mainnet.** Verified and tested on a fork
  only (docs/GAS-VERIFY.md). Deploy via docs/USER-STEPS.md step 1, then fill in this address.
- Tape-out circuit IDs for the 22 verified-beat circuits: **TODO - not yet tapped out for real.**
  Real, independently-verified calldata already exists for all 22 (apps/web's gallery / the
  `forge calldata` CLI command); actually submitting them is docs/USER-STEPS.md step 2, which
  mints the resulting circuit IDs to fill in here.
- Silicon export GitHub Actions run (task 12, GC-012):
  https://github.com/davieslennox0/maj3-silicon-spike/actions/runs/39150702389 - real synthesis
  + DRC pass, GDS sha256 `1857e6b1325f19d65bd4647d9ca18c166d2c0ea3dc88464a21ad59729eadf256`.
  Status: exported only - not submitted to Tiny Tapeout, not fabricated, not paid for.

## Access link

**TODO** - fill in once apps/web is published somewhere reachable (DeWEB per the optional
section above, or any plain static host - GitHub Pages, Vercel, etc. all work since it's a
pure static build with no backend). Until then, point reviewers at the repo itself:
https://github.com/davieslennox0/tapeout-forge and the build command (`pnpm --filter
@forgeout/web build`, serve `apps/web/dist`).

## Demo video

**TODO** - see docs/DEMO.md for the 3-minute script. Not recorded yet.
