// Browser stub for node:fs — see vite.config.ts and src/stubs/child_process.ts's comments.
// Only reached inside optimize.ts's tryAbcCandidates(), which is gated behind isAbcOnPath()
// (itself backed by the child_process stub, which always throws/returns false in-browser) —
// these are never actually called at runtime, just needed to satisfy the bundler's static
// named-export check.
function unavailable(): never {
  throw new Error("node:fs is not available in the browser build");
}
export const writeFileSync = unavailable;
export const readFileSync = unavailable;
export const unlinkSync = unavailable;
export const mkdtempSync = unavailable;
