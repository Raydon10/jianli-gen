import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");

await build({
  entryPoints: [join(appDir, "tiptap-editor.mjs")],
  bundle: true,
  format: "iife",
  globalName: "JianliTiptap",
  outfile: join(appDir, "tiptap-editor.bundle.js"),
  target: "es2020",
  platform: "browser"
});
