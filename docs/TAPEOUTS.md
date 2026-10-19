# Real tape-outs (append-only, written by scripts/tapeout.sh after each real success)

Each line: processor, circuit id (parsed from the real receipt's event, topics[1] of event
topic0 0xc11215e4... - confirmed live on a fork test 2026-10-19), and the real tx hash.

No real tape-out has been sent yet. (Two fork-only test runs of this exact script, used to
verify the circuit-id parsing logic works, were deliberately NOT recorded here - they were
disposable Anvil fork state, not real submissions, and keeping them here would misrepresent
this file's purpose.)
