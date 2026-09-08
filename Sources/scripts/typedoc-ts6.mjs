// TypeDoc needs the TypeScript JS compiler API, which typescript@7 (native
// Go compiler) no longer ships. This wrapper runs the TypeDoc CLI while
// redirecting every "typescript" import/require to the aliased
// "typescript-ts6" package (typescript@6.0.3), keeping the repo-wide
// type-checker on TypeScript 7.
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "typescript") {
      return nextResolve("typescript-ts6", context);
    }
    return nextResolve(specifier, context);
  },
});

const require = createRequire(import.meta.url);
const typedocDir = path.dirname(require.resolve("typedoc/package.json"));
// Direct file URL: typedoc's package "exports" map does not expose dist/cli.js.
await import(pathToFileURL(path.join(typedocDir, "dist/cli.js")).href);
