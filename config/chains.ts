// Per-chain config. Keep every RPC URL / chain id here, never hardcoded elsewhere.
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
}

// X Layer, chain 196. RPC VERIFIED reachable in prior research sessions.
export const X_LAYER: ChainConfig = {
  chainId: 196,
  name: "X Layer",
  rpcUrl: "https://rpc.xlayer.tech",
};

export const CHAINS: ChainConfig[] = [X_LAYER];

// The real FabX PoD-mining processor (on-chain name() == "FAB-Genisis"), CONFIRMED via a real
// decoded claim transaction, not inference. See docs/PROCESSOR-EVIDENCE.md for the evidence and
// tx hashes. EIP-55 checksummed.
// PHASE 6: this processor's transistor contract (same as FAB-Genesis NFT, 0xBe6f...eb714) is
// EXHAUSTED on the real chain (1,000,000/1,000,000 minted) with no acquisition route found
// (docs/ACQUIRE-AND-CLAIM.md). This path is SET ASIDE, not pursued further. Kept here for
// reference only - do not target this processor in any script by default.
export const FAB_TST_PROCESSOR = "0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6";
export const FAB_TST_PROCESSOR_NAME = "FAB-Genisis"; // real on-chain name(), not "FAB_TST"

// OrderGuard: the hackathon-path processor (PHASE 7 retarget, since FAB_TST is blocked).
// name() == "OrderGuard", read live via eth_call 2026-10-19 (selector 0x06fdde03), not copied
// from any doc. Its own separate transistor contract has real headroom, re-verified live
// 2026-10-19: supplyCap()=10000, minted()=42, mintPrice()=0.0001 OKB, protocolFee()=0.00066 OKB,
// TAPEOUT_FEE()=0.0013 OKB (all unchanged from earlier measurements - still current).
export const ORDERGUARD_PROCESSOR = "0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355";
export const ORDERGUARD_PROCESSOR_NAME = "OrderGuard"; // real on-chain name(), read live
export const ORDERGUARD_TRANSISTORS = "0x8e71FC45ff47E5a7bA1ad2960793ebAdD2739D9e";

// The processor every broadcast script targets by default. PHASE 7: retargeted to OrderGuard
// because FAB_TST's transistor supply is exhausted with no acquisition route (see above).
export const ACTIVE_PROCESSOR = ORDERGUARD_PROCESSOR;
export const ACTIVE_PROCESSOR_NAME = ORDERGUARD_PROCESSOR_NAME;
export const ACTIVE_TRANSISTORS = ORDERGUARD_TRANSISTORS;

// REAL deployed ForgeRegistry on X Layer mainnet. Deployed 2026-10-20, tx
// 0xad495798672b4d9c7dc4b2bdce16b64c6795fb1fad89fac469f8be327c74cc66, receipt status=1
// (VERIFIED: re-checked live via cast receipt + cast code, both confirm success - not assumed
// from the broadcast output alone). Scripts must treat this as the live registry and never
// redeploy while it has code - resuming a run with this unset was the real cause of the
// go-live stall (go-live.sh never persisted the address after a real deploy; env-var-only
// resume state does not survive a new shell invocation).
export const FORGE_REGISTRY_ADDRESS = "0xAFDd108b0efCC1FF4d1e1d32579F80501774912d";
