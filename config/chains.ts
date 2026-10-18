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
