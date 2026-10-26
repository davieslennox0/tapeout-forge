# Contributing

- Prerequisites and commands are in the README "Quick start" (Node 22, pnpm 9, iverilog, Foundry).
- Run `pnpm test` and, for contract changes, `forge test --fork-url https://rpc.xlayer.tech` before opening a pull request. CI runs both.
- Scripts that can broadcast must stay dry-run by default and must never accept a raw private key on the command line.
- Never commit keys, keystores, password files or `.env`. Do not add personal paths, hostnames or IP addresses to docs or scripts.
- Keep claims honest: new statements in the README, site or submission docs need an entry in `docs/CLAIMS.md` with its evidence. Use the required silicon wording from `docs/LIMITS.md` and never write "chip" without it.
