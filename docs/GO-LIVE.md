# Go-live: exact commands, in order, for the real owner

Nothing in this repo has sent anything for real. Every command below needs the owner's own
key and money. Read docs/COSTS.md first.

## 0. PHASE 7: targets OrderGuard, not FAB_TST

FAB_TST's transistor supply was found exhausted with no acquisition route
(docs/ACQUIRE-AND-CLAIM.md) — that path is set aside. This plan now targets **OrderGuard**
(`0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`), which has real transistor-supply headroom
(9,958 of 10,000 available, 349 needed for the 5 circuits below — see docs/COSTS.md). This
plan does NOT pursue real FabX PoD mining rewards — it satisfies the hackathon's own
requirements (a real on-chain tape-out + registry entry), which is a separate goal.

## 1. Create a new wallet

```
cast wallet import my-forgeout-key --interactive
```
Interactive prompt only — never pass a private key as a command-line argument, never paste one
into a script. This creates a named keystore account (`KEYSTORE_ACCOUNT=my-forgeout-key` for
every script below).

**What could go wrong**: using an existing wallet that already has unusual on-chain code (a
smart-contract wallet, an EIP-7702 delegation) breaks the mint step with a confusing
`ERC1155InvalidReceiver` revert (docs/NEW.md's mint-diagnosis finding) — use a genuinely fresh
plain EOA.

## 2. Fund it

Real total needed for all 5 final beats (GC-012/037/050/039/046): **0.0447 OKB**
(docs/COSTS.md). Send at least that much, ideally the spend cap with a 20% margin
(**0.05364 OKB**) to leave room for gas-price movement. Get the address: `cast wallet address
--account my-forgeout-key`.

**What could go wrong**: sending exactly the minimum leaves no room for real gas-price
volatility between dry-run and broadcast — fund the cap amount, not the bare total.

## 3. Check the wallet

```
KEYSTORE_ACCOUNT=my-forgeout-key
scripts/check-wallet.sh "$(cast wallet address --account $KEYSTORE_ACCOUNT)"
```
Confirms real balance/nonce before spending anything.

## 4. Deploy ForgeRegistry

```
KEYSTORE_ACCOUNT=my-forgeout-key scripts/deploy-registry.sh          # dry run first
KEYSTORE_ACCOUNT=my-forgeout-key scripts/deploy-registry.sh --broadcast
```
Real measured cost: **460,958 gas** (measured twice now, identical both times — Phase 5's
fork test and Phase 7's). At a typical real X Layer gas price this is a small fraction of an
OKB, but check the script's own printed estimate at the time, not this number, since gas price
moves.

**What could go wrong**: the script will not auto-record the deployed address — copy it into
`config/chains.ts` and `docs/SUBMISSION.md`'s Addresses section yourself, immediately.

## 5. Tape out each circuit, IN THIS ORDER: GC-012, then 037, 050, 039, 046

```
export FORGE_REGISTRY_ADDRESS=<from step 4>
KEYSTORE_ACCOUNT=my-forgeout-key scripts/tapeout.sh 12           # dry run first
KEYSTORE_ACCOUNT=my-forgeout-key scripts/tapeout.sh 12 --broadcast
```
Repeat per task (37, 50, 39, 46). Each run: confirms OrderGuard's real `name()` and that it has
real code, live, before spending; prints the real fee math; asks for a typed confirmation
(exact OKB / processor address / chain id); mints transistors; tapes out; and auto-parses the
real circuit id from the receipt's event (confirmed working against OrderGuard in a real Phase
7 fork test covering all 5 of these exact circuits) — appends it to `docs/TAPEOUTS.md` itself.

GC-012 is this project's strongest result (q=4.0, the scoring cap) — tape it out first so the
best evidence is on-chain soonest if time/budget runs out partway. GC-039 (nIn=6) is the
largest/most expensive to register (real fork-measured register gas: 18,191,899 — budget real
time/gas for it, it's an order of magnitude more than the others).

**What could go wrong**: re-run `scripts/check-wallet.sh` right before each broadcast, not
just once at the start — supply/price can move between runs.

## 6. Register each taped-out circuit

```
KEYSTORE_ACCOUNT=my-forgeout-key scripts/register.sh 12 <circuit-id-from-docs/TAPEOUTS.md>
KEYSTORE_ACCOUNT=my-forgeout-key scripts/register.sh 12 <circuit-id> --broadcast
```
For nIn<=6 (GC-012/037/050/039 all qualify), this fetches real `eval()` outputs and lets the
registry verify on-chain itself (real-tested against OrderGuard for all four:
`onchainVerified=true`). For GC-046 (nIn=8 > 6), it uses the attestation-only path
automatically (real-tested: `onchainVerified=false`, by design, not a bug — see
`contracts/src/ForgeRegistry.sol`'s `MAX_ONCHAIN_VERIFY_INPUTS`). Pass the real depth values
from docs/COSTS.md's table (8, 9, 7, 12, 10 respectively) — don't let them default to 0.

**What could go wrong**: if someone else registers a strictly-better circuit for the same
specHash between your tape-out and your register call, your submission reverts
`NotStrictlyBetter` — re-run `forge optimize` against live state right before submitting.

## 7. Reveal netlists and redeploy the web app

Only after a circuit is actually taped out (so publishing its netlist can no longer let
someone else front-run submitting it first):
```
REVEAL_NETLISTS=true pnpm --filter @forgeout/web build
scripts/deploy-web.sh forge.fanside.xyz /var/www/forge /etc/caddy/Caddyfile
```
**What could go wrong**: forgetting the flag on a later rebuild silently re-redacts a
previously-revealed site — note down which build you deployed.

## 8. Make the repo public

```
gh repo edit davieslennox0/tapeout-forge --visibility public --accept-visibility-change-consequences
```
Do this last, per docs/USER-STEPS.md's existing guidance — right before or at submission time.

**What could go wrong**: anything in git history stays recoverable even after a later delete —
this repo's secrets history was already audited clean (see earlier release-prep work), but
re-check for anything added locally since then.
