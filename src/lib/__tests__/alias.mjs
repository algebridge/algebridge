// Lets `node --experimental-strip-types` run tests that import app code:
// resolves the "@/..." path alias (tsconfig "paths") and extensionless
// relative imports the way the Next bundler does.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function withExtension(base) {
  if (/\.(ts|tsx|mjs|js)$/.test(base) && existsSync(base)) return base;
  for (const ext of [".ts", ".tsx"]) if (existsSync(base + ext)) return base + ext;
  const index = path.join(base, "index.ts");
  return existsSync(index) ? index : null;
}

registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (base) {
      const file = withExtension(base);
      if (file) return next(pathToFileURL(file).href, context);
    }
    return next(specifier, context);
  },
});
