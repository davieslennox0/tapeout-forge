# Real tape-outs (append-only, written by scripts/tapeout.sh after each real success)

Each line: task, processor, real circuit id (parsed from the real receipt's event, topics[1] of
event topic0 0xc11215e4... - confirmed live on a fork test 2026-10-19), the real tape-out tx,
the real register tx (recovered read-only from ForgeRegistry's Registered event logs, topic0
0xaade8b7e... - anchored to each tape-out tx's block number, since the RPC caps eth_getLogs at
100 blocks per call), the registry address, the real submitter, and the real verification status.

Registry v1 (SUPERSEDED, see the v2 section at the end): 0xAFDd108b0efCC1FF4d1e1d32579F80501774912d (deployed 2026-10-20, tx
0xad495798672b4d9c7dc4b2bdce16b64c6795fb1fad89fac469f8be327c74cc66, receipt status=1).
Submitter (all 5): 0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5.

- 2026-10-20: GC-012 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=6 | tapeoutTx=0x259da87e6a22449c5f3ee00c196ffaa249379a1f5f625eb48e771a62c7705c05 | registerTx=0x59048af8b9dfe8c832825a4cdf9880fefb2f5d4e81fa842f00666e0fef0f0da0 | verified on-chain via processor.eval
- 2026-10-20: GC-037 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=7 | tapeoutTx=0xdb3d0a339d94658f7c7f14dca7ee80e6fc45ca474bb9f5abc69acf5e07a0fe5a | registerTx=0x44f4e36ed2abd1c919f8e75744ce0c3c9e3afea00c3e2a7fcd89efe0b48cf9b2 | verified on-chain via processor.eval
- 2026-10-20: GC-050 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=8 | tapeoutTx=0x247e6c4ccce7d764cc27f847fc127288cc7f77ec1856c88550a893967bbf9235 | registerTx=0x7c9def59a11af8f1175ec9b4c16e752580b69229c2b314d19f8d3749da7c66dd | verified on-chain via processor.eval
- 2026-10-20: GC-014 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=9 | tapeoutTx=0xfa38b3d7a5b4f91fbfc74513feb4e68f5365475b548b03550f2c3efb0120b141 | registerTx=0xc29c6ac5cd924a754e4478f7b96f84c65b083e122762473a92b846ee6518f384 | verified on-chain via processor.eval
- 2026-10-20: GC-046 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=10 | tapeoutTx=0x5a358239bfa6f2fa6f190690197fc3396752231b6639bc9d32bf3094610013e5 | registerTx=0x3fdf3bad07b41b4bba4a8664a6b377ccb0d3bd4c645e35cd997cdcad102a6278 | attestation-only (8 inputs), not verified on-chain via processor.eval

## Additional test registrations (circuits 11-14), NOT showcase circuits

Registered 2026-10-26 by a separate throwaway test wallet while exercising the scripts on the real chain
(docs/ONCHAIN-TESTS.md). Submitter for all four: `0x155d4248621Bf2601A9F9171327b8081D302b171` (not the
showcase submitter above). Same registry (`0xAFDd108b0efCC1FF4d1e1d32579F80501774912d`) and processor
(`0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355`). The five showcase circuits are 6-10 in the section above;
these four are extra entries in registry v1 (nine entries in v1 in total).

- 2026-10-26: GC-007 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=11 | mintTx=0x7022098c610040990d44a35d24af62144dd9c7206c324492d22bb4c85bc20872 | tapeoutTx=0xdb02c5015e7aacbc59443f7c0bc482e897cb5d1ee0d398640268d6c5fe773039 | registerTx=0x6f57fedcfefed369b4ccf94939d25e5b5b4a6394c79d9375b89a405185c01a97 | submitter=0x155d4248621Bf2601A9F9171327b8081D302b171 | verified on-chain via processor.eval | registry depth=0 (see docs/ONCHAIN-TESTS.md, Finding 1)
- 2026-10-26: GC-016 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=12 | mintTx=0x0ad1302c40ba817f0e7a51d225d387b6c5a424e18e6b6e1df860b246e4dde99d | tapeoutTx=0xc7f2c944747ecb4c540bfcb0ac4d519180e75daec5e6b559ec906df7f616660c | registerTx=0xbc4e4d7f73d59832fd76e25201b20d67fc4978b53351e7c24e5496f5d97ab4ec | submitter=0x155d4248621Bf2601A9F9171327b8081D302b171 | verified on-chain via processor.eval | registry depth=10
- 2026-10-26: GC-013 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=13 | mintTx=0xb57db3bbfadd789e2de87f64c6c3f0d0ffedcf89ad578e2447b42060a9f544a0 | tapeoutTx=0xf5993734f556974ec25c2557fbec98199cc56eb16504c6c74186550afab3142a | registerTx=0xa8ef31b43147bc5c64f31b5c8a18a7704dedb620618b15ca9e3d45f8107f880f | submitter=0x155d4248621Bf2601A9F9171327b8081D302b171 | attestation-only (8 inputs), not verified on-chain via processor.eval | registry depth=10
- 2026-10-26: GC-022 | processor=0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 | circuitId=14 | mintTx=0xd70fe212c91047c1213fa26d44e6c4c9ac50f131b064929100693a96ddf74adf | tapeoutTx=0xeaedee4324d255b3851d5140cd178682a72a4592a0b426b48e66c2ecebe7558f | registerTx=0x52c6bacddeb13a73ca836738338bfa40848f91b937d1199820fc87bcf07e7e76 | submitter=0x155d4248621Bf2601A9F9171327b8081D302b171 | verified on-chain via processor.eval | registry depth=7

## Registry v2 (canonical since 2026-10-26)

Registry v2: 0xD304F09ba30c41196a6a3C66EBb117184306A06F, deployed 2026-10-26 from the project wallet (0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5), tx
0x35f2670b12b7af4907f57933a2394bc5b04eb74708e4061e9e5d83f203ce3748, receipt status=1. Same ForgeRegistry source; the runtime bytecode is identical to v1 (1,834 bytes), only the
compiler's trailing metadata hash differs. The five showcase circuits (ids 6 to 10, already taped out, so no new mint or
tape-out) were registered here with their real depths (8, 9, 7, 7, 10), because v1 holds them at depth 0, which it
cannot correct. Each was checked with `scripts/verify-live.sh` against v2 (`SUMMARY: PASS`). The four test registrations
(ids 11 to 14) were not re-registered and exist in v1 only.

- 2026-10-26: GC-012 | circuitId=6 | registerTxV2=0x3cb6a7092a9b3d05ac393498b42ccaf217c9291823c2c3dd471092e76914e30a | submitter=0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5 | verified on-chain via processor.eval
- 2026-10-26: GC-037 | circuitId=7 | registerTxV2=0x863ac9a23fb0d0cdd9a0b509f7d812ea1c337248e01b7dd36d5f8ad8af780e59 | submitter=0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5 | verified on-chain via processor.eval
- 2026-10-26: GC-050 | circuitId=8 | registerTxV2=0x24caf2bc21a7e687cbf5f3147e5e968dbbd4c10ec8a58d39b63b4fd7a287ec60 | submitter=0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5 | verified on-chain via processor.eval
- 2026-10-26: GC-014 | circuitId=9 | registerTxV2=0x523d5a788972954fc86d18c9ce10aaa32f454390dcf700b0f4c2f7b915241c23 | submitter=0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5 | verified on-chain via processor.eval
- 2026-10-26: GC-046 | circuitId=10 | registerTxV2=0xedbb77044aa57ff2a2f358bdb8517ce1daff757bce628e8f1e099efb5e3aa367 | submitter=0x1F4d4B97d9cFD57b2F5CED5b87249ECCa95920E5 | attestation-only (8 inputs), not verified on-chain via processor.eval
