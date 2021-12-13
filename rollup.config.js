import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";

export default defineConfig({
    external: [
        "picocolors",
        "semver/classes/semver","semver/functions/parse","semver/functions/satisfies"
    ],
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
