import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/styles/mention.css"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
  ],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
