import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export default defineConfig({
  tsconfig: true,
  external: ["node:util", "semver"],
  input: "src/index.ts",
  output: {
    format: "esm",
    dir: "dist",
  },
  plugins: [
    dts({
      generator: "oxc",
    }),
  ],
});
