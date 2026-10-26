# Required wording for any silicon-export claim

From BUILD.md section 7. Use verbatim in README and demo wherever silicon export
is mentioned:

> Tapeout-ready export. We have not ordered fabrication. Ordering is a separate
> paid step that the circuit owner completes on Tiny Tapeout. We do not claim a
> physical chip exists.

Status field for any export: `exported | submitted | fabricated`. This project
stays at `exported`. Never write "chip", "taped out to silicon" or "fabricated"
without this qualifier.

# Registry (ForgeRegistry) limits

Found in the pre-publication audit (2026-10-26); the registry is immutable, so these stay.

- **Self-reported numbers.** `gates`, `depth`, `nIn` and `nOut` come from the caller and are never checked against the processor.
- **"Verified" is circular.** For `nIn <= 6` it only means the caller's expected outputs equal the chosen processor's `eval()` of that circuit.
- **Caller-chosen processor.** A contract whose `eval` returns constants makes the entry read as verified. Readers of `best()` should accept only `processor == OrderGuard` (`0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`) and a submitter they trust.
- **`nIn` can be understated.** Passing `nIn = 0` checks a single output row and still sets `verified = true`.
- **Freeze.** `gates = 0` gives cost 0, and replacing an entry needs a strictly lower cost, so a spec hash can be locked forever by anyone for a few cents of gas. This applies to the canonical v2 entries too (they are intact as of 2026-10-26).
- **Spec hash is just `keccak("GC-nnn")`.** Nothing binds it to the task specification.
- **Empty-looking entries.** With `processor = address(0)` and `nIn > 6` the stored entry is treated as empty and the next submit overwrites it.
- **Front-running.** A pending submit can be copied by another sender, who becomes the recorded submitter.
- Not an issue: no reentrancy (the processor call is a `view`/STATICCALL), `cost()` cannot overflow, and a malicious processor or oversized input only burns the submitter's own gas.
- A v3 would read gates and `nIn` from the processor, require `gates > 0`, and use an allowlist or commit-reveal.

# Script limits

See the README section "Scripts that spend real funds": `AUTO_CONFIRM` skips confirmations, go-live's spend cap is checked after each step and ignores deploy and register gas, and `deploy-web.sh` / `finalize-release.sh` are operator-only.

