import { build } from "esbuild";

await build({
  entryPoints: ["tiptap-editor.mjs"],
  bundle: true,
  format: "iife",
  globalName: "JianliTiptap",
  outfile: "tiptap-editor.bundle.js",
  target: "es2020",
  platform: "browser"
});
