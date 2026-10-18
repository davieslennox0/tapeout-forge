// Browser stub for node:url — see src/stubs/child_process.ts's comment. Never actually
// called at runtime (gated behind isAbcOnPath(), always false in-browser).
export function fileURLToPath(): never {
  throw new Error("node:url is not available in the browser build");
}
