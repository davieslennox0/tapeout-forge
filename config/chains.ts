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
// tx hashes. EIP-55 checksummed. Verified consistent against a second, independently-fetched
// transaction receipt (topic[2] of the claim event) during the 2026-10-19 address integrity check.
export const FAB_TST_PROCESSOR = "0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6";
export const FAB_TST_PROCESSOR_NAME = "FAB-Genisis"; // real on-chain name(), not "FAB_TST"
