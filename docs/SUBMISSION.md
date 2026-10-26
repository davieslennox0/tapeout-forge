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

Circuit builders and FabX Proof-of-Design miners on X Layer, to be reached through the FabX/TapeOut
Discord and the public task-bank community (no outreach is claimed yet) where a "beats the reference" claim is directly
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

## Why users might pay and keep using it (hypothesis, UNVALIDATED)

Verification and headroom are the product, not raw gas savings (X Layer gas is cheap - BUILD.md
section 1 explicitly says not to claim large gas savings as the value). A wrong "my circuit is
equivalent" claim costs real money once funds depend on it (a vault, a policy processor); FabX's
winner-take-the-bonus scoring means a beaten incumbent needs to find out fast, not guess, and
keeps coming back as the task bank and the field of competing circuits change over time.

## TapeOut ecosystem features used

- TapeOut circuits/contracts on X Layer, chain 196: read-only `eval()`/`circuitInfo`/`netlist`
  calls against the real deployed processor `0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`
  (OrderGuard) and live circuits on the FabX processor FAB_TST `0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6` (e.g. id=65, id=49) - see docs/NEW.md and
  packages/chain/test/chain.test.ts for the real on-chain reads this project makes.
- FabX Proof-of-Design task bank and scoring formula (api.fabx.tech) - the entire replay
  (docs/FABX-REPLAY.md) is built from FabX's own real task bank and real fetched vectors.
- DeWEB/TapeKit: researched (docs/DEWEB-RESEARCH.md), not deployed - optional per BUILD.md
  section 2 ("none required"). apps/web's static build already satisfies DeWEB's publish
  constraints so it could be published later without changes.
- ForgeRegistry (contracts/src/ForgeRegistry.sol): built, ABI-verified against the real processor,
  tested on a live X Layer fork, then deployed to X Layer mainnet on 2026-10-20 (address under Addresses).
- Silicon export (docs/SILICON.md): `forge export-silicon` generates a real Tiny Tapeout
  `ttsky`-shaped repo directory from a netlist. One real circuit (task 12, GC-012) has been run
  all the way through Tiny Tapeout's own GitHub Actions CI for real - synthesis and DRC both
  passed (15/15 precheck checks), producing a real 34-cell GDS. Status never exceeds "exported" -
  no ordering, no payment, no shuttle submission. See docs/SILICON.md for the exact wording and
  limits.

## Addresses

- Processor used for the nine tape-outs (five showcase plus four test) and their on-chain verification: `0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`
  (OrderGuard, X Layer, chain 196) - VERIFIED, real reads. Reads of FAB_TST circuits (e.g. id=65) use `0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6`.
- FAB-Genesis NFT: `0xBe6f94115D32f3AC3252bc4626573e739bEeb714` - VERIFIED (BUILD.md section 3).
- ForgeRegistry v2 (canonical): `0xD304F09ba30c41196a6a3C66EBb117184306A06F` (X Layer, chain 196), deployed 2026-10-26, tx
  `0x35f2670b12b7af4907f57933a2394bc5b04eb74708e4061e9e5d83f203ce3748` (receipt status=1) from the project wallet. VERIFIED: the five showcase entries (circuit ids 6 to 10)
  were registered here with correct depths and re-read on 2026-10-26 with `scripts/verify-live.sh` (read-only); all return
  the submitter `0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5`.
- ForgeRegistry v1 (superseded): `0xAFDd108b0efCC1FF4d1e1d32579F80501774912d`, deployed 2026-10-20, tx
  `0xad495798672b4d9c7dc4b2bdce16b64c6795fb1fad89fac469f8be327c74cc66`. It holds the same five showcase entries at depth 0
  (immutable, cannot be corrected) plus four additional test registrations (ids 11 to 14, submitter
  `0x155d4248621Bf2601A9F9171327b8081D302b171`).
- Real tape-outs: five showcase circuits (ids 6 to 10, table below) plus four additional test registrations (ids 11 to 14, see docs/TAPEOUTS.md and docs/ONCHAIN-TESTS.md), all on the OrderGuard processor `0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`,
  each registered in ForgeRegistry (full tables: docs/TAPEOUTS.md). The other 13 verified-beat
  circuits in the gallery have **not** been tapped out.

  | task | circuit id | tape-out tx | register tx | status |
  |---|---|---|---|---|
  | GC-012 | 6 | `0x259da87e6a22449c5f3ee00c196ffaa249379a1f5f625eb48e771a62c7705c05` | `0x59048af8b9dfe8c832825a4cdf9880fefb2f5d4e81fa842f00666e0fef0f0da0` | verified on-chain via processor.eval |
  | GC-037 | 7 | `0xdb3d0a339d94658f7c7f14dca7ee80e6fc45ca474bb9f5abc69acf5e07a0fe5a` | `0x44f4e36ed2abd1c919f8e75744ce0c3c9e3afea00c3e2a7fcd89efe0b48cf9b2` | verified on-chain via processor.eval |
  | GC-050 | 8 | `0x247e6c4ccce7d764cc27f847fc127288cc7f77ec1856c88550a893967bbf9235` | `0x7c9def59a11af8f1175ec9b4c16e752580b69229c2b314d19f8d3749da7c66dd` | verified on-chain via processor.eval |
  | GC-014 | 9 | `0xfa38b3d7a5b4f91fbfc74513feb4e68f5365475b548b03550f2c3efb0120b141` | `0xc29c6ac5cd924a754e4478f7b96f84c65b083e122762473a92b846ee6518f384` | verified on-chain via processor.eval |
  | GC-046 | 10 | `0x5a358239bfa6f2fa6f190690197fc3396752231b6639bc9d32bf3094610013e5` | `0x3fdf3bad07b41b4bba4a8664a6b377ccb0d3bd4c645e35cd997cdcad102a6278` | attestation-only (8 inputs), not verified on-chain via processor.eval |

- Silicon export GitHub Actions run (task 12, GC-012):
  https://github.com/davieslennox0/maj3-silicon-spike/actions/runs/40386501894 - real synthesis
  + DRC pass, GDS sha256 `de5bf3943a43fb8cfefb3680b7e6bb77c690ff991314c7293dbd02bfed2a9097`.
  Status: exported only - not submitted to Tiny Tapeout, not fabricated, not paid for.

## Access link

https://forgeout.xyz (also www.forgeout.xyz) is the one canonical address for the web app. It went live on
2026-10-26 (HTTP 200, valid Let's Encrypt certificate, HTTP redirects to HTTPS) and serves the build with netlists
revealed. Source:
https://github.com/davieslennox0/tapeout-forge, build with `pnpm --filter @forgeout/web build`, serve `apps/web/dist`.

## Demo video

Not recorded yet, so there is no link to give. The 3-minute script and exact commands are in docs/DEMO.md.

## Limits and unverified

- **No reward claims.** FabX's reward variables F and K_task are undefined anywhere public, so no
  reward amount is reported or predicted; this project only reports C and q. These nine circuits
  are on OrderGuard, not a FabX PoD processor, and are not FabX-PoD-eligible.
- **LATCH:** the `step()` ABI for sequential circuits is unverified, and so is the power-up state
  of a latch on silicon. Sequential tasks are excluded from the replay.
- **Synthesis gap:** no proven-exact synthesis above 3 inputs; 13 of the 46 complete-spec tasks
  still lose to the reference.
- **Scope of the replay:** 54 sampled-only tasks (8 wide-input combinational tasks with 9 to 18 inputs, plus all
  46 sequential ones) are excluded, because fitting only sampled vectors would be overfitting.
- **GC-046** (8 inputs) is attestation-only, not verified on-chain via processor.eval; the other
  four tape-outs are verified on-chain via processor.eval.
- **Silicon export: layout generated, not ordered.** Tapeout-ready export. We have not ordered
  fabrication. Ordering is a separate paid step that the circuit owner completes on Tiny Tapeout.
  We do not claim a physical chip exists. The generated Tiny Tapeout project has one failing check, `viewer`
  (GitHub Pages is not enabled on that repo); the GDS build, the 15/15 precheck checks, the gate-level test and the RTL test and docs workflows pass (docs/SILICON.md).
- **Registry v1 depth.** Registry v1's entries registered before the 2026-10-26 fix (the five showcase circuits and test
  entry GC-007) carry `depth = 0`. v1 is immutable and prices depth 0 as 1 (`gates x 1` instead of `gates x depth^3`), so
  those entries cannot be corrected and misprice v1's "best" comparison. The five showcase circuits were therefore
  re-registered in registry v2 with real depths, which is the canonical registry. Both registries take `gates`, `depth`,
  `nIn` and `nOut` from the caller without checking them against the processor, so costs are self-reported.
  Test entries 11 to 14 exist in v1 only. Details: docs/ONCHAIN-TESTS.md.
- **What "verified on-chain via processor.eval" means.** The registry checks that the caller's expected
  outputs equal the processor's `eval()` of that same circuit, for up to 6 inputs. It does not check the circuit
  against the task's specification; that comparison is done off-chain (`verify-live.sh`, the independent verifier).
- **TapeOut factory not sealed.** Checked 2026-10-26: `isSealed()` is false on the factory (`0x1f09DAeFA827f02CBb40967cc91b259763760761`),
  whose owner can upgrade `eval` for every processor (implementation at that time `0xb41C1E7602EB5734BE2430b72178ccb814A5293d`). Netlists are
  immutable once taped out, but the evaluation logic is only as stable as that upgrade key; the on-chain "verified" results here describe the logic as of that date.
- **Hackathon rules not re-verified today.** The rules in BUILD.md section 2 (event dates, required fields) come from the official page as read earlier; the
  page could not be re-fetched during the 2026-10-26 research, so any later change to dates or required fields is not reflected. Re-check before submitting.
- **More registry abuse paths (audit, 2026-10-26).** A caller can freeze a spec hash by registering `gates = 0`, can claim `verified` through a processor of their own choosing or by understating `nIn`, and entries are not bound to the task specification. Anyone reading `best()` should accept only `processor == OrderGuard` and a trusted submitter. Full list: docs/LIMITS.md.
- **Spend caps are weak.** The scripts are dry-run by default and keystore-only, but go-live's cap is checked after each step and ignores deploy and register gas; the wallet balance is the real cap (README, "Scripts that spend real funds").

