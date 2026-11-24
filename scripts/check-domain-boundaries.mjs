import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(process.argv[2] ?? ".");
const src = path.join(root, "src");
const files = readdirSync(src, { recursive: true })
  .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"))
  .sort();
const known = new Set(files);
const graph = new Map();
const serverOnly = new Set();
const clients = new Set();
const serverActions = new Set();
const violations = [];
const directDatabaseRoutes = [];
const prefix = (file) => file.match(/^domains\/([^/]+)\//)?.[1];
const importsDatabase = (name) => /^@\/lib\/supabase(?:\/|$)/.test(name);

for (const file of files) {
  const content = readFileSync(path.join(src, file), "utf8");
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const first = source.statements[0];
  if (
    first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression)
  ) {
    if (first.expression.text === "use client") clients.add(file);
    if (first.expression.text === "use server") serverActions.add(file);
  }
  if (file.endsWith(".server.ts")) serverOnly.add(file);

  const edges = [];
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement)
    )
      continue;
    const specifier = statement.moduleSpecifier?.text;
    if (!specifier) continue;
    if (specifier === "server-only") serverOnly.add(file);
    if (
      file.startsWith("app/api/") &&
      file.endsWith("/route.ts") &&
      importsDatabase(specifier)
    ) {
      directDatabaseRoutes.push(file);
    }
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
    const unresolved = specifier.startsWith("@/")
      ? specifier.slice(2)
      : path.posix.normalize(
          path.posix.join(path.posix.dirname(file), specifier),
        );
    const target = [
      unresolved,
      unresolved + ".ts",
      unresolved + ".tsx",
      unresolved + "/index.ts",
    ].find(
      (candidate) =>
        known.has(candidate) && existsSync(path.join(src, candidate)),
    );
    if (!target) continue;

    if (file.startsWith("shared/") && prefix(target)) {
      violations.push(`${file} imports domain ${target}`);
    }
    if (
      prefix(file) &&
      prefix(target) &&
      prefix(file) !== prefix(target) &&
      !target.endsWith("/index.ts")
    ) {
      violations.push(`${file} imports domain internals ${target}`);
    }
    const typeOnly = ts.isImportDeclaration(statement)
      ? statement.importClause?.isTypeOnly
      : statement.isTypeOnly;
    edges.push({ target, typeOnly: Boolean(typeOnly) });
  }
  graph.set(file, edges);
}

const state = new Map();
const stack = [];
const cycles = [];
function walk(file) {
  state.set(file, "visiting");
  stack.push(file);
  for (const { target, typeOnly } of graph.get(file)) {
    if (typeOnly) continue;
    if (!state.has(target)) walk(target);
    else if (state.get(target) === "visiting") {
      cycles.push([...stack.slice(stack.indexOf(target)), target]);
    }
  }
  stack.pop();
  state.set(file, "visited");
}
for (const file of files) if (!state.has(file)) walk(file);
for (const cycle of cycles) {
  if (cycle.some((file) => /^(domains|shared)\//.test(file))) {
    violations.push(`Runtime cycle ${cycle.join(" → ")}`);
  }
}

for (const client of clients) {
  const seen = new Set();
  function checkClient(file) {
    if (seen.has(file) || serverActions.has(file)) return;
    seen.add(file);
    if (serverOnly.has(file)) {
      violations.push(`Client ${client} reaches server-only ${file}`);
      return;
    }
    for (const { target, typeOnly } of graph.get(file))
      if (!typeOnly) checkClient(target);
  }
  checkClient(client);
}

const report = {
  files: files.length,
  cycles,
  directDatabaseRoutes: [...new Set(directDatabaseRoutes)],
  violations,
};
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exitCode = 1;
