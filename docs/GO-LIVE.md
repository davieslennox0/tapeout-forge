# Go-live: a single copy-paste runbook for the real owner

Nothing in this repo has sent anything for real. Every command below needs the owner's own
key and money. Read docs/COSTS.md first. For every command: the expected output shape is
given, followed by the on-chain check to run, followed by what to do if it fails.

**If any step fails: STOP. Do not retry blindly.** A failed tape-out or register call can
still cost real gas even when it reverts — re-running the same thing again without finding out
why it failed just spends gas twice. Read the revert reason, fix the actual cause, re-run
`preflight.sh`, then try again.

## 0. PHASE 7 retarget: this plan targets OrderGuard, not FAB_TST

FAB_TST's transistor supply was found exhausted with no acquisition route
(docs/ACQUIRE-AND-CLAIM.md) — that path is set aside. This plan targets **OrderGuard**
(`0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`), which has real transistor-supply headroom.
This does NOT pursue real FabX PoD mining rewards — it satisfies the hackathon's own
requirements (a real on-chain tape-out + registry entry), a separate goal.

## 1. Create a new wallet

```
cast wallet import my-forgeout-key --interactive
```
**Expected output**: prompts for a password, then prints `my-forgeout-key` created at
`~/.foundry/keystores/`. Never pass a private key as a command-line argument.

**What could go wrong**: using an existing wallet with unusual on-chain code (a smart-contract
wallet, an EIP-7702 delegation) breaks the mint step with `ERC1155InvalidReceiver` — use a
genuinely fresh plain EOA.

## 2. Fund it

Two real, fork-tested options (docs/COSTS.md has the full breakdown):

| variant | 5th circuit | real total (fees+gas×1.5) | fund this much |
|---|---|---|---|
| A | GC-039 (nIn=6, 18.19M gas register — a real outlier) | 0.045517 OKB | **0.05462 OKB** |
| B | GC-014 (nIn=4, cheap, real fork-tested: verified=true) | 0.034285 OKB | **0.0412 OKB** (use the same 0.05462 cap to be safe either way) |

Get the address: `cast wallet address --account my-forgeout-key`. Send the funding amount to it.

**What could go wrong**: sending exactly the bare total leaves no room for real gas-price
movement — fund the cap amount shown above, not the bare total.

## 3. Preflight (STEP 0 — run this before every broadcast, not just once)

```
scripts/preflight.sh "$(cast wallet address --account my-forgeout-key)" --variant gc039
```
**Expected output**: 6 lines of `PASS:`/`FAIL:`/`SKIP:`, ending in `ALL CHECKS PASS` (exit 0)
or `ONE OR MORE CHECKS FAILED` (exit 1).

**On-chain check**: none needed — this command *is* the check.

**If it fails**: read which specific line failed (balance too low? processor code missing?
gas price spiked?) and fix that specific cause before re-running. Do not proceed to step 4.

## 4. Deploy ForgeRegistry

```
KEYSTORE_ACCOUNT=my-forgeout-key scripts/deploy-registry.sh          # dry run first
KEYSTORE_ACCOUNT=my-forgeout-key scripts/deploy-registry.sh --broadcast
```
**Expected output**: a deployed contract address, real gas used (measured twice already in
this project, both times exactly 460,958 gas).

**On-chain check**: `cast code <the address> --rpc-url https://rpc.xlayer.tech` returns
non-empty bytecode.

**What could go wrong**: the script does not auto-record the address — copy it into
`config/chains.ts` (as `FORGE_REGISTRY_ADDRESS` for later steps) and `docs/SUBMISSION.md`'s
Addresses section immediately. If `eth_getCode` comes back empty despite a "success" status,
this project has hit that exact silent-failure mode before (Phase 7's own fork-test mistake,
caused by a broken `forge inspect` path) — do not trust a deploy you haven't personally
`eth_getCode`-checked.

## 5. Tape out GC-012 first

```
export FORGE_REGISTRY_ADDRESS=<from step 4>
KEYSTORE_ACCOUNT=my-forgeout-key scripts/tapeout.sh 12           # dry run first
KEYSTORE_ACCOUNT=my-forgeout-key scripts/tapeout.sh 12 --broadcast
```
**Expected output**: real fee math printed, a typed-confirmation prompt (type the exact OKB /
processor address / chain id back), then a real circuit id parsed from the receipt, appended
to `docs/TAPEOUTS.md` automatically.

**On-chain check**: run step 6 (verify-live) immediately after.

GC-012 is this project's strongest result (q=4.0, the scoring cap) — tape it out first so the
best evidence is on-chain soonest if time/budget runs out partway.

## 6. verify-live GC-012

```
scripts/verify-live.sh 12 <circuit-id-from-step-5> <tapeout-tx-hash> --rpc https://rpc.xlayer.tech
```
**Expected output**: a `PASS:`/`FAIL:` line for netlist-byte-match and on-chain evaluation,
ending `SUMMARY: PASS`. Appends a row to `docs/TAPEOUTS.md`.

**If it fails** (netlist mismatch especially): STOP. Do not register this circuit id — the
on-chain bytes don't match what you think you taped out.

## 7. Repeat steps 5-6 for GC-037, then GC-050, then GC-046

Same commands, substituting the task id (37, 50, 46). GC-046 has nIn=8.

## 8. Register each taped-out circuit (same order: 12, 37, 50, 46)

```
KEYSTORE_ACCOUNT=my-forgeout-key scripts/register.sh 12 <circuit-id>
KEYSTORE_ACCOUNT=my-forgeout-key scripts/register.sh 12 <circuit-id> --broadcast
```
**Expected output**: for GC-012/037/050 (nIn<=6): real `eval()` outputs fetched, registry
verifies on-chain itself, real-tested `onchainVerified=true`. For GC-046 (nIn=8>6):
attestation-only path automatically, real-tested `onchainVerified=false` **by design, not a
bug** (`contracts/src/ForgeRegistry.sol`'s `MAX_ONCHAIN_VERIFY_INPUTS=6`). Pass the real depth
values from docs/COSTS.md (8, 9, 7, 10 for 012/037/050/046) — do not let them default to 0.

**On-chain check**: `cast call <registry> "best(bytes32)(...)" <specHash>` and confirm the
fields match what you expect (see verify-live.sh's own registry-read for the exact shape).

**What could go wrong**: if someone else registers a strictly-better circuit for the same
specHash between your tape-out and register call, your submission reverts `NotStrictlyBetter`
— re-run `forge optimize` against live state right before submitting, not a stale local run.

## 9. OPTIONAL, LAST: GC-039 (or its safer substitute, GC-014)

GC-039's register step is a real outlier: **18,191,899 gas**, an order of magnitude above
every other circuit here. Before sending it for real:
```
cast estimate <registry> "submit(...)" ... --rpc-url https://rpc.xlayer.tech
```
and confirm the estimate is still in the ~18M range, not something that's grown further.
If you'd rather skip this risk entirely, use **GC-014 instead** — real fork-tested drop-in
replacement (mint 86,399 gas → tapeout 252,933 gas, circuitId parsed cleanly → register
752,379 gas, `onchainVerified=true`), at roughly 1/24th the gas cost. Same steps 5-6-8 above,
substituting task id 14 (or 39).

## 10. Reveal netlists and redeploy the web app

Only after circuits are actually taped out (so publishing netlists can't let someone else
front-run submitting them first):
```
REVEAL_NETLISTS=true pnpm --filter @forgeout/web build
scripts/deploy-web.sh forge.fanside.xyz /var/www/forge /etc/caddy/Caddyfile
```
**On-chain check**: none — this is a web deploy. Verify by fetching
`https://forge.fanside.xyz` and confirming the gallery now shows real netlist/calldata buttons
instead of "Published after tape-out."

**What could go wrong**: forgetting the flag on a later rebuild silently re-redacts a
previously-revealed site — note down which build you deployed.

## 11. Make the repo public

```
gh repo edit davieslennox0/tapeout-forge --visibility public --accept-visibility-change-consequences
```
Do this last, right before or at submission time.

**What could go wrong**: anything in git history stays recoverable even after a later delete —
this repo's secrets history was already audited clean, but re-check for anything added
locally since.
