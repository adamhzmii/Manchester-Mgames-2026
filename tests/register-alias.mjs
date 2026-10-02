// Lets `node --test` resolve the project's "@/..." imports the way tsconfig
// and Next do. Node strips TypeScript types itself but knows nothing about
// path aliases, so modules that import one another as "@/lib/x" would
// otherwise fail to load under test.
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
