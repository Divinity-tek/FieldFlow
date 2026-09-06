#!/usr/bin/env node
/**
 * CI guard: fail the build when routes, sidebar entries, or lazy imports
 * reference deleted pages or unused files.
 *
 * Checks performed:
 *   1. Every `lazy(() => import("..."))` target in src/App.tsx resolves to a file.
 *   2. Every <Route path="..."> in src/App.tsx references a defined component.
 *   3. Every sidebar `path: "/..."` in src/components/layout/AppSidebar.tsx
 *      matches a <Route path="..."> in src/App.tsx (params/wildcards allowed).
 *   4. No import in src/App.tsx or AppSidebar.tsx points at a missing file.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const APP = join(ROOT, "src/App.tsx");
const SIDEBAR = join(ROOT, "src/components/layout/AppSidebar.tsx");

const EXTS = [".tsx", ".ts", ".jsx", ".js"];
const errors = [];
const err = (m) => errors.push(m);

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // bare package
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const e of EXTS) if (existsSync(base + e)) return base + e;
  for (const e of EXTS) {
    const idx = join(base, "index" + e);
    if (existsSync(idx)) return idx;
  }
  return null;
}

function checkImports(file, src) {
  const re = /import\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
    if (!resolveImport(file, spec)) {
      err(`${file}: import target not found → "${spec}"`);
    }
  }
}

// --- Load files ---
for (const f of [APP, SIDEBAR]) {
  if (!existsSync(f)) {
    err(`required file missing: ${f}`);
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

const appSrc = readFileSync(APP, "utf8");
const sideSrc = readFileSync(SIDEBAR, "utf8");

checkImports(APP, appSrc);
checkImports(SIDEBAR, sideSrc);

// --- 1. lazy() targets ---
const lazyRe = /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)\s*\)/g;
const lazyComponents = new Map(); // name -> spec
let lm;
while ((lm = lazyRe.exec(appSrc))) {
  const [, name, spec] = lm;
  lazyComponents.set(name, spec);
  if (!resolveImport(APP, spec)) {
    err(`App.tsx: lazy import → "${spec}" (component ${name}) — file not found`);
  }
}

// --- 2. <Route path="..." element={<X .../>}> map ---
const routeRe = /<Route\s+[^>]*path=["']([^"']+)["'][^>]*element=\{\s*<(\w+)/g;
const routePaths = new Set();
const routeComponents = new Set();
let rm;
while ((rm = routeRe.exec(appSrc))) {
  routePaths.add(rm[1]);
  routeComponents.add(rm[2]);
}

// Also: <Route path="x"> ... </Route> wrappers without element=
const routeOpenRe = /<Route\s+[^>]*path=["']([^"']+)["']/g;
let rom;
while ((rom = routeOpenRe.exec(appSrc))) routePaths.add(rom[1]);

// Components referenced in routes must be imported/defined somewhere in App.tsx
for (const c of routeComponents) {
  const defined =
    lazyComponents.has(c) ||
    new RegExp(`\\b(?:import\\s+${c}\\b|import\\s+\\{[^}]*\\b${c}\\b[^}]*\\}|const\\s+${c}\\s*=|function\\s+${c}\\b)`).test(appSrc);
  if (!defined) err(`App.tsx: <Route> uses <${c}/> but it is not imported or defined`);
}

// --- 3. Sidebar paths must match a route ---
function normalize(p) {
  return p.replace(/^\//, "").replace(/\/+$/, "");
}
function routeMatches(sidebarPath) {
  const sp = normalize(sidebarPath).split("/");
  for (const rp of routePaths) {
    const rps = normalize(rp).split("/");
    if (rps.length !== sp.length && !rps.includes("*")) continue;
    let ok = true;
    for (let i = 0; i < rps.length; i++) {
      const a = rps[i], b = sp[i];
      if (a === "*") { ok = true; break; }
      if (a?.startsWith(":")) continue;
      if (a !== b) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

const sidebarPathRe = /path:\s*["'](\/[^"']*)["']/g;
const sidebarPaths = new Set();
let sm;
while ((sm = sidebarPathRe.exec(sideSrc))) sidebarPaths.add(sm[1]);

for (const p of sidebarPaths) {
  if (p === "/" || p.startsWith("/#") || p.startsWith("/?")) continue;
  if (!routeMatches(p)) {
    err(`AppSidebar.tsx: nav path "${p}" has no matching <Route> in App.tsx`);
  }
}

// --- Report ---
if (errors.length) {
  console.error("\n✗ Route/sidebar integrity check failed:\n");
  for (const e of errors) console.error("  - " + e);
  console.error(`\n${errors.length} problem(s).`);
  process.exit(1);
}
console.log(`✓ Route integrity OK — ${lazyComponents.size} lazy imports, ${routePaths.size} routes, ${sidebarPaths.size} sidebar paths.`);
