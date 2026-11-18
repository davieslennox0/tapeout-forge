import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// equivalence.ts's execSync(`which <bin>`) and optimize.ts's ABC integration (execFileSync,
// plus fs/os/path/url for its temp-file round-trip) are Node-only availability probes for
// optional external tools (SAT binary / yosys-abc, BUILD.md 1.5/1b.1 "never required") -
// genuinely dead code in-browser, already gated behind try/catch that falls back gracefully
// when the tool is simply missing from PATH (exactly what happens here). Aliased to tiny
// throw-stubs so Vite/Rollup can statically bundle the named imports rather than failing.
// VITE_BASE=./ for a DeWEB build (relative asset paths; the gateway doesn't serve from a real
// root), matching the convention used by sibling TapeOut Accelerate projects (e.g. proofdrop's
// `VITE_BASE=./ pnpm build`). Defaults to "/" for the ordinary forgeout.xyz build, unchanged.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  resolve: {
    alias: {
      "node:child_process": fileURLToPath(new URL("./src/stubs/child_process.ts", import.meta.url)),
      "node:fs": fileURLToPath(new URL("./src/stubs/fs.ts", import.meta.url)),
      "node:os": fileURLToPath(new URL("./src/stubs/os.ts", import.meta.url)),
      "node:path": fileURLToPath(new URL("./src/stubs/path.ts", import.meta.url)),
      "node:url": fileURLToPath(new URL("./src/stubs/url.ts", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
  },
});
