# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's "Report a vulnerability" (Security tab) on this repository, not in a public issue. If that is unavailable, open an issue asking for a private contact without describing the problem.

## Scope

- The scripts in `scripts/` (they can broadcast real transactions; see the README section "Scripts that spend real funds").
- The ForgeRegistry contract (`contracts/src/ForgeRegistry.sol`), deployed on X Layer (chain 196): v2 `0xD304F09ba30c41196a6a3C66EBb117184306A06F` is the canonical one; v1 `0xAFDd108b0efCC1FF4d1e1d32579F80501774912d` is superseded.
- The web app in `apps/web` (static, runs in the browser, no backend).

## Known limits (not vulnerabilities)

These are documented in `docs/LIMITS.md` and `docs/SUBMISSION.md`:

- The registry takes `gates`, `depth`, `nIn` and `nOut` from the caller; its "verified" flag only means the supplied outputs matched the chosen processor's own `eval()`. Anyone reading `best()` should accept only `processor == OrderGuard (0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355)` and a submitter they trust.
- A submitter can freeze a spec hash by registering `gates = 0`, because replacing an entry needs a strictly lower cost.
- The TapeOut factory is not sealed; its owner can upgrade `eval` for every processor.
- Dev-only advisories exist in the test toolchain (vitest, vite, esbuild); they affect the dev server and test UI, not the shipped static app.

Never commit private keys, mnemonics, keystores, password files or `.env` files. If you find one in this repository's history, report it.
