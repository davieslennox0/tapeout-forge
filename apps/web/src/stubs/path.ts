// Browser stub for node:path — see src/stubs/child_process.ts's comment. Never actually
// called at runtime (gated behind isAbcOnPath(), always false in-browser).
function unavailable(): never {
  throw new Error("node:path is not available in the browser build");
}
export const join = unavailable;
export const dirname = unavailable;
