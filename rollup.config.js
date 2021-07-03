import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";

export default defineConfig({
    external: ["chalk", "semver"],
    input: "src/index.ts",
    output: [
        {
            format: "cjs",
            file: "dist/index.cjs",
            exports: "named"
        },
        {
            format: "esm",
            dir: "dist",
        }
    ],
    plugins: [
        typescript()
    ],
});
