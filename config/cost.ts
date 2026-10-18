// Per-chain cost constants. gasFixed/gasPerGate are MEASURED (BUILD.md section 3),
// not protocol-guaranteed — re-verify before relying on them for a submission.
export interface CostConfig {
  chainId: number;
  /** eval() fixed overhead gas. MEASURED on X Layer processor 0x57F3...a355. */
  gasFixed: number;
  /** eval() marginal gas per effective gate (user gates + 2 buffer NANDs/output). MEASURED. */
  gasPerGate: number;
  /** OKB per tape-out, if known for this processor. null = unset. */
  tapeOutFeeOkb: number | null;
  /** OKB per NAND transistor, if known for this processor. null = unset. */
  perTransistorFeeOkb: number | null;
  /** OKB protocol fee, if known. null = unset. */
  protocolFeeOkb: number | null;
}

export const X_LAYER_COST: CostConfig = {
  chainId: 196,
  gasFixed: 43783,
  gasPerGate: 1952,
  // Fees seen on processor 0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355 (BUILD.md section 3).
  // Left null here because they are processor-specific, not chain-wide; set per processor
  // at the call site instead of assuming every processor charges the same.
  tapeOutFeeOkb: null,
  perTransistorFeeOkb: null,
  protocolFeeOkb: null,
};

// BNB's measured gas/gate (~2317) differs from X Layer's — BUILD.md section 3.
// Not modeled here yet since this project targets X Layer only; noted so nobody
// assumes the X Layer constant applies cross-chain.
export const BNB_GAS_PER_GATE_UNVERIFIED = 2317;
