"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    }).trim();
  } catch {
    return "";
  }
}

try {
  const root = git(["rev-parse", "--show-toplevel"], process.cwd())
    || path.resolve(__dirname, "..");
  const graphPath = path.join(root, "graphify-out", "graph.json");
  if (!fs.existsSync(graphPath)) {
    process.exit(0);
  }

  const head = git(["rev-parse", "HEAD"], root);
  const metadataPath = path.join(root, "graphify-out", "project-metadata.json");
  let builtAtCommit = "";
  let includedFiles = [];
  let metadataOlderThanGraph = true;
  try {
    const metadataStat = fs.statSync(metadataPath);
    const graphStat = fs.statSync(graphPath);
    metadataOlderThanGraph = metadataStat.mtimeMs < graphStat.mtimeMs;
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    builtAtCommit = metadata.graphBuiltAtCommit || "";
    includedFiles = Array.isArray(metadata.filesIncluded)
      ? metadata.filesIncluded.filter((file) => typeof file === "string"
        && !path.isAbsolute(file) && !file.startsWith("../"))
      : [];
  } catch {
    // Older graphs can still be used cautiously without wrapper metadata.
  }

  const freshnessPaths = includedFiles.length > 0 ? includedFiles : [
    "src", "tests", "docs", "tools", "index.html", "README.md",
    "package.json", "tsconfig.json", "vite.config.ts", "eslint.config.js",
    "vercel.json", "CLAUDE.md", "AGENTS.md", "WORKFLOW.md", "scripts",
    ".claude", ".codex", ".agents", ".graphifyignore", ".gitignore",
  ];
  const dirty = Boolean(git([
    "status", "--porcelain=v1", "--untracked-files=normal", "--",
    ...freshnessPaths, ".graphifyignore", ".gitignore",
  ], root));
  const updateFlag = fs.existsSync(path.join(root, "graphify-out", "needs_update"))
    || fs.existsSync(path.join(root, "graphify-out", ".needs_update"));
  const stale = updateFlag || dirty
    || metadataOlderThanGraph || !builtAtCommit || !head || builtAtCommit !== head;

  const status = stale
    ? "It may need updating; never trust it over current source."
    : "It appears current, but source remains authoritative.";
  process.stdout.write(
    `[Graphify] A local knowledge graph is available. Query it before unfamiliar, `
    + `architectural, debugging, cross-cutting, or likely multi-file work; verify `
    + `the cited source files. ${status}\n`,
  );
} catch {
  // Session startup must remain non-blocking even for a missing/corrupt graph.
  process.exit(0);
}
