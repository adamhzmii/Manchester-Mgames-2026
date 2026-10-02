import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = new URL(specifier.slice(2), SRC).href;
    for (const suffix of [".ts", ".tsx", "/index.ts"]) {
      const candidate = base + suffix;
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate, context);
    }
  }
  return nextResolve(specifier, context);
}
