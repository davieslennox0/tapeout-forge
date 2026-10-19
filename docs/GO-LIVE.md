# Go-live: exact commands, in order, for the real owner

Nothing in this repo has sent anything for real. Every command below needs the owner's own
key and money. Read docs/COSTS.md and docs/CLAIM-PATH.md first.

## 0. REAL BLOCKER — read this before anything else

FAB_TST's transistor supply is **exhausted right now** (`supplyCap()==minted()==1,000,000`,
see docs/COSTS.md). A brand-new wallet (step 1 below) cannot mint any transistors — `mint()`
will revert `"supply cap"` for anyone. **Step 5 (tape out) cannot proceed for real until this
changes** — either FabX raises the cap, or the owner acquires already-minted transistors from
an existing holder some other way (not scripted here; this project found no mechanism for
that). Steps 1-4 below (wallet, funding, registry deployment) are NOT blocked by this and can
proceed regardless.

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

Real total needed for all 5 planned beats (GC-012/046/045/043/044): **0.2633 OKB**
(docs/COSTS.md). Send at least that much, ideally the full spend cap (**0.31596 OKB**) to
leave margin for gas-price movement. Get the address: `cast wallet address --account
my-forgeout-key`.

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
Real measured cost on a fork: **460,958 gas** (first real measurement in this project — prior
docs only had on-chain *verify-call* gas, not deployment gas). At a typical ~0.02-0.03 Gwei
real gas price on X Layer this is a small fraction of an OKB, but check the script's own
printed estimate at the time, not this number, since gas price moves.

**What could go wrong**: the script will not auto-record the deployed address — copy it into
`config/chains.ts` and `docs/SUBMISSION.md`'s Addresses section yourself, immediately, so a
later step doesn't target a stale/missing registry.

## 5. Tape out each circuit, IN THIS ORDER: GC-012, then 046, 045, 043, 044

```
export FORGE_REGISTRY_ADDRESS=<from step 4>
KEYSTORE_ACCOUNT=my-forgeout-key scripts/tapeout.sh 12           # dry run first
KEYSTORE_ACCOUNT=my-forgeout-key scripts/tapeout.sh 12 --broadcast
```
Repeat per task. Each run: confirms the processor's real `name()` live before spending,
prints the real fee math, asks for a typed confirmation (exact OKB / processor address / chain
id), mints transistors (blocked by step 0 above until the real supply cap changes), tapes out,
and **auto-parses the real circuit id from the receipt's event** (confirmed working against 2
real fork tests this session) — appends it to `docs/TAPEOUTS.md` itself.

Order matters only in that GC-012 is this project's strongest result (q=4.0, the scoring cap)
— tape it out first so the best evidence is on-chain soonest if time/budget runs out partway.

**What could go wrong**: besides step 0's blocker, the real transistor supply cap could also
get raised then re-exhausted by other teams between your dry-run and your broadcast — re-run
`scripts/check-wallet.sh` style supply check right before broadcasting each one, not just once
at the start.

## 6. Register each taped-out circuit

```
KEYSTORE_ACCOUNT=my-forgeout-key scripts/register.sh 12 <circuit-id-from-docs/TAPEOUTS.md>
KEYSTORE_ACCOUNT=my-forgeout-key scripts/register.sh 12 <circuit-id> --broadcast
```
For nIn<=6 (GC-012 qualifies), this fetches real `eval()` outputs and lets the registry verify
on-chain itself (real-tested: gas 2,358,048, `verified=true`). For nIn>6 tasks, it uses the
attestation-only path automatically.

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
