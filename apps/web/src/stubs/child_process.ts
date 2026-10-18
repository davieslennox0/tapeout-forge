// Browser stub for node:child_process - see vite.config.ts's comment. Both stubs throw;
// every real call site (equivalence.ts's optional-SAT-binary probe, optimize.ts's
// isAbcOnPath()/tryAbcCandidates() ABC integration) already wraps the call in try/catch and
// falls back gracefully (BUILD.md 1.5/1b.1: ABC and any SAT binary are "never required"), so
// throwing here just triggers the same graceful fallback already exercised when those
// binaries are simply missing from PATH - not special-cased for the browser.
export function execSync(): never {
  throw new Error("execSync is not available in the browser build - no SAT binary can be on PATH here");
}
export function execFileSync(): never {
  throw new Error("execFileSync is not available in the browser build - no ABC binary can be on PATH here");
}
