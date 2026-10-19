# Processor evidence (read-only on-chain investigation)

Goal: establish from on-chain evidence which processor address(es) FabX PoD mining accepts.
Method hierarchy: a real claim transaction/event > official API field > bytecode/name() alone.

## Verdict: CONFIRMED

**`0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6`** (on-chain `name()` = "FAB-Genisis"; this
project's own prior notes call it "FAB_TST") is the real, FabX-recognized PoD processor.

Evidence, strongest first:
1. **Real on-chain claim events reference it directly.** Scanning recent `eth_getLogs` on the
   mining contract `0x4F6A2312D80753BdAFd35DDB1Bf4BB14C43F8265` (topic0
   `0x7c9c1f2b9aa7cd28c79cdeb371997e1c61e4aa92cf7c29b91d01287092f94937`), at least two real,
   distinct events from different transactions both carry
   `0x00000000000000000000000087bfca3494aa228ff589ab9b642143a5e8c8f9a6` as an INDEXED topic,
   alongside real circuit ids (`0x1707`=5895, `0x1708`=5896):
   - tx `0x63a650855b1f896c447aa9eda85d624932ce5a27f951a166dc22e25df392f260`
   - tx `0x1485d375baf6518bb3b6f5bcd4b262b09aebeba94fc4174d597486d440bfafd4`
2. **Real top-level transactions pass it as a parameter directly** to the same mining contract:
   - tx `0xf7ec0b5ac3ea70d7be77c39f5a7e0cdce33250ecb9ceb6f55c014bdb60ecba57` (from
     `0x0ee61d7e98328d285779be0d694b83dcb2f00989`, selector `0xc7b21b6c`, word[0] = this address)
   - tx `0x3586e2b9e54a1cd6c23bf86765ba47ef075e3c73ca28f497776db1945c5ecfc1` (from
     `0x93d037c5e6632590f6c18ad16a9689657cb3b9ab`, selector `0xa3494614`, word[0] = this address,
     word[1] = `0x0e0d` = circuit id 3597, word[4] = `0x100` = 256, matching the project's known
     256-vector sampling)
3. **Official API lists it with a live multiplier.** Fresh `GET https://api.fabx.tech/v1/pod/state?chainId=196`
   returns `"multipliers": {"0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6": 6, "0x265e2580cb9c3fc059f2aa3cf20ad30f3f0a653c": 0}`
   — a live, server-side field, not a guess. Multiplier 6 matches this project's own prior
   BUILD.md note about a "correlation-matched multiplier 6," now independently corroborated by
   a completely different evidence path (real claim events), not just restated.

Five distinct senders were found claiming in the same 500-block sample (3 more routed through
the canonical ERC-4337 EntryPoint `0x0000000071727de22e5e9d8baf0edac6f37da032`, same underlying
mining contract) — real, ongoing usage, not a one-off.

## Correction to this project's own earlier evidence

The prior `name()` = "FAB-Genisis" fact (docs/NEW.md:23) was flagged UNCONFIRMED by an earlier
pass in this project, reasonably, since a bare `name()` string match is weak alone and
"FAB-Genesis" is also a separate NFT contract's name elsewhere. That caution was warranted at
the time — but it's now resolved: the real claim-event evidence above is independent of that
name() call and stands on its own.

## `0x265e2580cb9c3fc059f2aa3cf20ad30f3f0a653c` ("RefBench", multiplier=0): UNCONFIRMED

Listed in the same official `multipliers` map (same mechanism, same API field), which is
suggestive — but no real claim transaction or event referencing this specific address was found
in the sampled block range. Likely a real registered processor (same registry, same shape of
evidence source), just not independently proven by a claim tx in this session's sample size.

## `0x4F6A2312D80753BdAFd35DDB1Bf4BB14C43F8265` ("mining"): CONFIRMED real and active, but NOT a processor

`owner()` succeeds and exactly matches the live API's `global.owner` field — this is a real,
active contract. An earlier step in this same investigation checked its EIP-1967
implementation/beacon storage slots (both read as zero) and concluded the proxy was dead; that
conclusion is WRONG and is corrected here — `owner()` and the claim-event emissions above prove
it is live. The zero-slot finding is real but doesn't mean what was first assumed; this contract
simply isn't delegating through that particular slot for its own logic, or uses a different
pattern than assumed. Separately, and for an unrelated reason: `circuitInfo()`/`netlist()`/`eval()`
all revert on it — correctly, since this is the mining/reward-distribution contract, not a
TAP-02 circuit-hosting processor at all. "Mining contract" and "processor" are two different
roles; this address is the former, `0x87bfca...f9a6` is the latter.

## `0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355` ("OrderGuard"): real processor, but NOT shown to be FabX-PoD-linked

This is the processor this entire project has used for tape-out testing throughout. It is a
real, independently-verified TAP-02 processor (confirmed via `name()`, full ABI, live `eval()`
testing). But nothing in this investigation — or any prior one in this project — links it to a
real FabX PoD claim event the way `0x87bfca...f9a6` is now linked above. **If the goal is
targeting FabX's actual PoD mining rewards, use FAB_TST
(`0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6`), not OrderGuard.**

## Step 5 (Processor Factory registry cross-check): not reached

Not completed in this session given the strength of the claim-event evidence already obtained
in steps 2-4 above. A future pass could still cross-check the official TapeOut Processor Factory
registry for completeness, but the verdict above does not depend on it.

## Answer to "which processor address to use"

**Use `0x87bfca3494aa228ff589ab9b642143a5e8c8f9a6` for anything targeting FabX PoD mining
specifically** — this is now the first address in this project's whole history to be confirmed
via a real on-chain claim event, not inference. OrderGuard remains the right choice only for
generic TapeOut tape-out testing unrelated to FabX's own PoD reward tracking.
