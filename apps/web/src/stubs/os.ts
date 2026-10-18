// Browser stub for node:os — see src/stubs/child_process.ts's comment. Never actually called
// at runtime (gated behind isAbcOnPath(), always false in-browser).
export function tmpdir(): never {
  throw new Error("node:os is not available in the browser build");
}
