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

// Processor-specific fees for OrderGuard (0x57F319CF056F72F48cF1dbb670F2A3DB007Aa355),
// VERIFIED 2026-10-18 via direct cast calls on an X Layer fork (BUILD.md 2.3/2.4):
// TAPEOUT_FEE()=1300000000000000 wei, transistors().mintPrice()=100000000000000 wei,
// transistors().protocolFee()=660000000000000 wei - these exactly match the figures
// BUILD.md section 3 had only as 'seen/reported'; now independently re-confirmed live.
// Per-processor, NOT chain-wide - do not apply to any other processor without re-checking.
export const ORDERGUARD_FEES = {
  tapeOutFeeOkb: 0.0013,
  perTransistorFeeOkb: 0.0001,
  protocolFeeOkb: 0.00066,
};

// Processor-specific fees for FAB_TST (0x87BFCa3494Aa228fF589ab9B642143A5e8c8F9a6), the
// CONFIRMED real FabX PoD processor (docs/PROCESSOR-EVIDENCE.md) - VERIFIED 2026-10-19 via
// direct cast calls against the real chain (not a fork): TAPEOUT_FEE()=1300000000000000 wei,
// transistors()=0xBe6f94115D32f3AC3252bc4626573e739bEeb714 (the SAME contract as the
// FAB-Genesis NFT - not a separate transistors contract), mintPrice()=500000000000000 wei
// (DIFFERENT from OrderGuards 0.0001 - do not reuse that number for this processor),
// protocolFee()=660000000000000 wei. Do not conflate with ORDERGUARD_FEES above.
export const FAB_TST_FEES = {
  tapeOutFeeOkb: 0.0013,
  perTransistorFeeOkb: 0.0005,
  protocolFeeOkb: 0.00066,
};

// CRITICAL, VERIFIED 2026-10-19: FAB_TST transistors supply is EXHAUSTED on the real chain
// right now - supplyCap()==minted()==1000000. A live mint(0,1) simulation from a fresh EOA
// reverts "supply cap". No new transistors can currently be minted by anyone. See
// docs/COSTS.md. Scripts must surface this, not silently retry/hide it.
export const FAB_TST_TRANSISTOR_SUPPLY_EXHAUSTED = true;

// Hard spend cap for Phase 5 go-live scripts (BUILD.md Phase 5 rule: "spend cap from config").
// = docs/COSTS.md real total for the 5 planned beats (0.2633 OKB) x 1.2 margin.
// Every spending script must refuse to --broadcast if its own computed real cost exceeds this.
export const PHASE5_SPEND_CAP_OKB = 0.31596;
