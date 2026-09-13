import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

/**
 * Packages that only exist inside a bundled Next.js app.
 * `server-only` is a build-time guard that throws unless the bundler maps it; for
 * direct Node execution it is a no-op. Stubbing it lets the tests import real server
 * modules instead of duplicating their logic.
 */
const STUBS = new Set(["server-only", "client-only"]);

/** Find a real file for an extensionless specifier. */
function resolveCandidate(base) {
  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

/**
 * Resolve `@/x` to `<root>/x` and extensionless relative imports to their source file,
 * because Next.js/webpack allow `./x` while Node's ESM resolver does not.
 */
export async function resolve(specifier, context, nextResolve) {
  if (STUBS.has(specifier)) {
    return { url: "stub:noop", format: "module", shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const found = resolveCandidate(path.join(projectRoot, specifier.slice(2)));
    if (found) return { url: found, shortCircuit: true };
    throw new Error(`Cannot resolve alias import: ${specifier}`);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : projectRoot;
    const found = resolveCandidate(path.resolve(path.dirname(parentPath), specifier));
    if (found) return { url: found, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/** Strip types from TypeScript sources so they can be evaluated by Node. */
export async function load(url, context, nextLoad) {
  if (url === "stub:noop") {
    return { format: "module", source: "export {};", shortCircuit: true };
  }
  if (url.startsWith("file:") && (url.endsWith(".ts") || url.endsWith(".tsx"))) {
    const filePath = fileURLToPath(url);
    const source = fs.readFileSync(filePath, "utf8");
    const isTsx = url.endsWith(".tsx");
    const output = ts.transpileModule(source, {
      fileName: filePath,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: isTsx ? ts.JsxEmit.ReactJSX : ts.JsxEmit.Preserve,
        verbatimModuleSyntax: false,
        esModuleInterop: true,
        isolatedModules: true,
      },
    });
    return { format: "module", source: output.outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
