# Real tape-outs (append-only, written by scripts/tapeout.sh after each real success)

Each line: task, processor, real circuit id (parsed from the real receipt's event, topics[1] of
event topic0 0xc11215e4... - confirmed live on a fork test 2026-10-19), the real tape-out tx,
the real register tx (recovered read-only from ForgeRegistry's Registered event logs, topic0
0xaade8b7e... - anchored to each tape-out tx's block number, since the RPC caps eth_getLogs at
100 blocks per call), the registry address, the real submitter, and the real verification status.

Registry: 0xAFDd108b0efCC1FF4d1e1d32579F80501774912d (deployed 2026-10-20, tx
0xad495798672b4d9c7dc4b2bdce16b64c6795fb1fad89fac469f8be327c74cc66, receipt status=1).
Submitter (all 5): 0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5.

- 2026-10-20: GC-012 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=6 | tapeoutTx=0x259da87e6a22449c5f3ee00c196ffaa249379a1f5f625eb48e771a62c7705c05 | registerTx=0x59048af8b9dfe8c832825a4cdf9880fefb2f5d4e81fa842f00666e0fef0f0da0 | verified on-chain via processor.eval
- 2026-10-20: GC-037 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=7 | tapeoutTx=0xdb3d0a339d94658f7c7f14dca7ee80e6fc45ca474bb9f5abc69acf5e07a0fe5a | registerTx=0x44f4e36ed2abd1c919f8e75744ce0c3c9e3afea00c3e2a7fcd89efe0b48cf9b2 | verified on-chain via processor.eval
- 2026-10-20: GC-050 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=8 | tapeoutTx=0x247e6c4ccce7d764cc27f847fc127288cc7f77ec1856c88550a893967bbf9235 | registerTx=0x7c9def59a11af8f1175ec9b4c16e752580b69229c2b314d19f8d3749da7c66dd | verified on-chain via processor.eval
- 2026-10-20: GC-014 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=9 | tapeoutTx=0xfa38b3d7a5b4f91fbfc74513feb4e68f5365475b548b03550f2c3efb0120b141 | registerTx=0xc29c6ac5cd924a754e4478f7b96f84c65b083e122762473a92b846ee6518f384 | verified on-chain via processor.eval
- 2026-10-20: GC-046 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=10 | tapeoutTx=0x5a358239bfa6f2fa6f190690197fc3396752231b6639bc9d32bf3094610013e5 | registerTx=0x3fdf3bad07b41b4bba4a8664a6b377ccb0d3bd4c645e35cd997cdcad102a6278 | attestation-only (8 inputs), not on-chain-eval verified
