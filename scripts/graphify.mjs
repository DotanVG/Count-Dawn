#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const EXPECTED_VERSION = "0.9.30";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "graphify-out");
const graphPath = path.join(outputDir, "graph.json");
const manifestPath = path.join(outputDir, "manifest.json");
const metadataPath = path.join(outputDir, "project-metadata.json");
const canonicalSkill = path.join(
  repoRoot, ".claude", "skills", "graphify", "SKILL.md",
);
const codexAdapter = path.join(
  repoRoot, ".agents", "skills", "graphify", "SKILL.md",
);
const sourcePaths = [
  "src", "tests", "docs", "tools", "index.html", "README.md", "package.json",
  "tsconfig.json", "vite.config.ts", "eslint.config.js", "vercel.json",
  "CLAUDE.md", "AGENTS.md", "WORKFLOW.md", "scripts", ".claude", ".codex",
  ".agents", ".graphifyignore", ".gitignore",
];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: options.encoding,
    env: {
      ...process.env,
      GRAPHIFY_OUT: "graphify-out",
      GRAPHIFY_NO_TIPS: "1",
      ...(options.env || {}),
    },
    shell: false,
    stdio: options.stdio || (options.encoding ? "pipe" : "inherit"),
    timeout: options.timeout,
  });
}

function outputOf(command, args, timeout = 5000) {
  const result = run(command, args, { encoding: "utf8", timeout });
  if (result.status !== 0 || result.error) return "";
  return (result.stdout || result.stderr || "").trim();
}

function commandWorks(command, args = ["--version"]) {
  return Boolean(outputOf(command, args));
}

function commandAvailable(command) {
  const finder = process.platform === "win32" ? "where.exe" : "which";
  return Boolean(outputOf(finder, [command], 2000));
}

function pythonProbe(command, prefix = []) {
  const code = [
    "import json,sys",
    "from importlib.metadata import version",
    "import graphify",
    "print(json.dumps({'executable':sys.executable,'python':sys.version.split()[0],",
    "'graphify':version('graphifyy')}))",
  ].join(";");
  const result = outputOf(command, [...prefix, "-c", code]);
  if (!result) return null;
  try {
    return JSON.parse(result.split(/\r?\n/).at(-1));
  } catch {
    return null;
  }
}

function venvPython(venvPath) {
  if (!venvPath) return [];
  return process.platform === "win32"
    ? [path.join(venvPath, "Scripts", "python.exe")]
    : [path.join(venvPath, "bin", "python")];
}

function uvToolPythons() {
  if (!commandWorks("uv", ["--version"])) return [];
  const toolDir = outputOf("uv", ["tool", "dir"]);
  if (!toolDir) return [];
  return [
    path.join(toolDir, "graphifyy", "Scripts", "python.exe"),
    path.join(toolDir, "graphifyy", "bin", "python"),
  ];
}

function pipxPythons() {
  if (!commandWorks("pipx", ["--version"])) return [];
  const home = outputOf("pipx", ["environment", "--value", "PIPX_LOCAL_VENVS"]);
  if (!home) return [];
  return [
    path.join(home, "graphifyy", "Scripts", "python.exe"),
    path.join(home, "graphifyy", "bin", "python"),
  ];
}

function installedPythonInfo() {
  const candidates = [
    ...venvPython(process.env.VIRTUAL_ENV),
    ...uvToolPythons(),
    ...pipxPythons(),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const info = pythonProbe(candidate);
    if (info) return info;
  }
  for (const [command, prefix] of [
    ["python3", []],
    ["python", []],
    ["py", ["-3"]],
  ]) {
    const info = pythonProbe(command, prefix);
    if (info) return info;
  }
  return null;
}

function graphifyVersion(engine) {
  const value = outputOf(engine.command, [...engine.prefix, "--version"], 30000);
  return value.match(/graphify\s+([0-9.]+)/i)?.[1] || "unknown";
}

function findGraphify({ allowEphemeral = true } = {}) {
  const activePython = venvPython(process.env.VIRTUAL_ENV)[0];
  if (activePython && fs.existsSync(activePython) && pythonProbe(activePython)) {
    return {
      command: activePython,
      prefix: ["-m", "graphify"],
      mechanism: "active virtual environment",
    };
  }

  if (commandWorks("graphify")) {
    const info = installedPythonInfo();
    const mechanism = info?.executable?.includes(`${path.sep}uv${path.sep}tools${path.sep}`)
      ? "uv tool"
      : info?.executable?.toLowerCase().includes("pipx")
        ? "pipx"
        : "graphify executable on PATH";
    return { command: "graphify", prefix: [], mechanism };
  }

  for (const candidate of uvToolPythons()) {
    if (!fs.existsSync(candidate) || !pythonProbe(candidate)) continue;
    return {
      command: candidate,
      prefix: ["-m", "graphify"],
      mechanism: "uv tool",
    };
  }

  for (const candidate of pipxPythons()) {
    if (!fs.existsSync(candidate) || !pythonProbe(candidate)) continue;
    return {
      command: candidate,
      prefix: ["-m", "graphify"],
      mechanism: "pipx",
    };
  }

  for (const [command, prefix] of [
    ["python3", []],
    ["python", []],
    ["py", ["-3"]],
  ]) {
    if (!pythonProbe(command, prefix)) continue;
    return {
      command,
      prefix: [...prefix, "-m", "graphify"],
      mechanism: "Python environment",
    };
  }

  if (allowEphemeral && commandWorks("uv", ["--version"])) {
    return {
      command: "uv",
      prefix: [
        "tool", "run", "--from", `graphifyy==${EXPECTED_VERSION}`, "graphify",
      ],
      mechanism: "uv tool run (pinned fallback)",
    };
  }
  if (allowEphemeral && commandWorks("pipx", ["--version"])) {
    return {
      command: "pipx",
      prefix: [
        "run", "--spec", `graphifyy==${EXPECTED_VERSION}`, "graphify",
      ],
      mechanism: "pipx run (pinned fallback)",
    };
  }
  return null;
}

function requireEngine() {
  const engine = findGraphify();
  if (engine) {
    const version = graphifyVersion(engine);
    if (version === EXPECTED_VERSION) return engine;
    const allowUnverified = /^(1|true|yes)$/i.test(
      process.env.GRAPHIFY_ALLOW_UNVERIFIED_VERSION || "",
    );
    if (allowUnverified) {
      console.warn(
        `[graphify wrapper] WARNING: using unverified Graphify ${version}; expected ${EXPECTED_VERSION}.`,
      );
      return engine;
    }
    console.error(
      `Graphify ${version} is installed, but this workflow is verified with ${EXPECTED_VERSION}.`,
    );
    console.error(
      `Install the pinned tool with: uv tool install --reinstall "graphifyy==${EXPECTED_VERSION}"`,
    );
    console.error(
      "Set GRAPHIFY_ALLOW_UNVERIFIED_VERSION=1 only for an intentional compatibility test.",
    );
    process.exit(1);
  }
  console.error(
    `Graphify is not installed. Recommended: uv tool install "graphifyy==${EXPECTED_VERSION}"`,
  );
  console.error(
    `Alternatives: pipx install "graphifyy==${EXPECTED_VERSION}" or install it in an active venv.`,
  );
  process.exit(1);
}

function parseJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function git(args) {
  return outputOf("git", args);
}

function trackedFiles() {
  const result = run("git", ["ls-files", "-z"], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout.split("\0").filter(Boolean).map((item) => item.replaceAll("\\", "/"));
}

function dirtySourceFiles() {
  const result = run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "--", ...sourcePaths],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
}

function normalizedManifestFiles(manifest) {
  if (!manifest || Array.isArray(manifest) || typeof manifest !== "object") return [];
  return Object.keys(manifest).map((file) => {
    const normalized = file.replaceAll("\\", "/");
    if (!path.isAbsolute(file)) return normalized.replace(/^\.\//, "");
    const relative = path.relative(repoRoot, file).replaceAll("\\", "/");
    return relative.startsWith("../") ? normalized : relative;
  }).sort();
}

function graphStats(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.links)
    ? graph.links
    : Array.isArray(graph?.edges) ? graph.edges : [];
  const communities = new Set(
    nodes.map((node) => node.community).filter((value) => value !== null && value !== undefined),
  );
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    communityCount: communities.size,
  };
}

function analysisTokenUsage() {
  const analysis = parseJson(path.join(outputDir, ".graphify_analysis.json"));
  const input = Number(analysis?.tokens?.input);
  const output = Number(analysis?.tokens?.output);
  if (!Number.isFinite(input) && !Number.isFinite(output)) return null;
  return {
    input: Number.isFinite(input) ? input : 0,
    output: Number.isFinite(output) ? output : 0,
    measured: true,
  };
}

function reportTokenUsage() {
  try {
    const report = fs.readFileSync(path.join(outputDir, "GRAPH_REPORT.md"), "utf8");
    const match = report.match(
      /Token cost:\s*([\d,]+)\s*input\s*[·|]\s*([\d,]+)\s*output/i,
    );
    if (!match) return null;
    return {
      input: Number(match[1].replaceAll(",", "")),
      output: Number(match[2].replaceAll(",", "")),
      measured: true,
    };
  } catch {
    return null;
  }
}

function combinedTokenUsage(extraction, communityLabeling) {
  const extractionUsage = extraction || { input: 0, output: 0, measured: false };
  const labelUsage = communityLabeling || { input: 0, output: 0, measured: false };
  return {
    extraction: extractionUsage,
    communityLabeling: labelUsage,
    total: {
      input: extractionUsage.input + labelUsage.input,
      output: extractionUsage.output + labelUsage.output,
      measured: extractionUsage.measured || labelUsage.measured,
    },
  };
}

function currentState(graph, dirtyFiles) {
  const head = git(["rev-parse", "HEAD"]);
  const builtAt = graph?.built_at_commit || "";
  const updateFlag = fs.existsSync(path.join(outputDir, "needs_update"))
    || fs.existsSync(path.join(outputDir, ".needs_update"));
  return {
    head,
    builtAt,
    current: Boolean(head && builtAt && head === builtAt && !updateFlag && dirtyFiles.length === 0),
    updateFlag,
  };
}

function recordMetadata({
  engine,
  durationSeconds,
  extractionMode,
  operation,
  dirtyBefore,
  measuredTokens = null,
}) {
  const graph = parseJson(graphPath);
  if (!graph) return;
  const previous = parseJson(metadataPath);
  const manifest = parseJson(manifestPath);
  const includedFiles = normalizedManifestFiles(manifest);
  const includedSet = new Set(includedFiles);
  const skippedFiles = trackedFiles().filter((file) => !includedSet.has(file));
  const dirtyAfter = dirtySourceFiles();
  const state = currentState(graph, dirtyAfter);
  const interpreter = installedPythonInfo();
  const stats = graphStats(graph);
  const recordedAt = new Date().toISOString();
  const operationRecord = {
    operation,
    recordedAt,
    durationSeconds: Number(durationSeconds.toFixed(3)),
    extractionMode,
    tokenUsage: measuredTokens,
    gitCommit: state.head,
    graphBuiltAtCommit: state.builtAt,
    workingTreeHadUncommittedSourceChanges: dirtyBefore.length > 0,
    uncommittedSourceFilesAtStart: dirtyBefore,
  };
  const fullBuild = operation === "build"
    ? operationRecord
    : previous?.fullBuild ?? null;
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(metadataPath, `${JSON.stringify({
    schemaVersion: 1,
    recordedAt,
    graphifyDistribution: "graphifyy",
    graphifyVersion: graphifyVersion(engine),
    graphifyExecutable: "graphify",
    graphifyModule: "graphify",
    installationMechanism: engine.mechanism,
    pythonInterpreter: interpreter?.executable ?? null,
    pythonVersion: interpreter?.python ?? null,
    operation,
    extractionMode: fullBuild?.extractionMode ?? extractionMode,
    generationDurationSeconds: fullBuild?.durationSeconds
      ?? Number(durationSeconds.toFixed(3)),
    fullBuild,
    lastOperation: operationRecord,
    filesIncluded: includedFiles,
    filesSkipped: skippedFiles,
    includedFileCount: includedFiles.length,
    skippedFileCount: skippedFiles.length,
    ...stats,
    tokenUsage: fullBuild?.tokenUsage ?? measuredTokens,
    gitCommit: state.head,
    graphBuiltAtCommit: state.builtAt,
    workingTreeHadUncommittedSourceChanges: dirtyBefore.length > 0,
    uncommittedSourceFilesAtStart: dirtyBefore,
    uncommittedSourceFilesAfter: dirtyAfter,
    needsUpdateFlag: state.updateFlag,
    graphCurrent: state.current,
  }, null, 2)}\n`, "utf8");
}

function ensureLocalOutputArgs(args) {
  const disallowed = [
    "--out", "--output", "--graph", "--global", "--postgres",
    "--google-workspace", "--no-gitignore",
  ];
  const hit = args.find((arg) => disallowed.some(
    (flag) => arg === flag || arg.startsWith(`${flag}=`),
  ));
  if (hit) {
    console.error(
      `The repository wrapper does not accept ${hit}; all graph input/output must stay project-local.`,
    );
    process.exit(2);
  }
}

function invoke(engine, args) {
  const result = run(engine.command, [...engine.prefix, ...args]);
  if (result.error) {
    console.error(`Unable to launch Graphify: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

function requireGraph() {
  if (fs.existsSync(graphPath)) return;
  console.error("No local graph exists. Run `npm run graph:build` first.");
  process.exit(1);
}

function hasFlag(args, name) {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function normalizeQueryArgs(args) {
  const options = [];
  const questionParts = [];
  let hasBudget = false;
  let explicitBudget = 1600;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dfs") {
      options.push(arg);
    } else if (arg === "--budget" || arg === "--context") {
      const value = args[index + 1];
      if (value === undefined) {
        console.error(`${arg} requires a value.`);
        process.exit(2);
      }
      options.push(arg, value);
      index += 1;
      if (arg === "--budget") {
        hasBudget = true;
        explicitBudget = Number(value);
      }
    } else if (arg.startsWith("--budget=")) {
      hasBudget = true;
      explicitBudget = Number(arg.slice("--budget=".length));
      options.push(arg);
    } else if (arg.startsWith("--context=")) {
      options.push(arg);
    } else if (arg.startsWith("-")) {
      console.error(`Unsupported query option: ${arg}`);
      process.exit(2);
    } else {
      questionParts.push(arg);
    }
  }
  if (questionParts.length === 0) {
    console.error("Provide a question after `--`.");
    process.exit(2);
  }
  if (hasBudget && (!Number.isInteger(explicitBudget)
    || explicitBudget < 1 || explicitBudget > 4000)) {
    console.error("Query budget must be an integer from 1 to 4000 tokens.");
    process.exit(2);
  }
  return {
    question: questionParts.join(" "),
    options,
    hasBudget,
  };
}

function semanticBuildArgs(extra) {
  if (hasFlag(extra, "--code-only") && hasFlag(extra, "--backend")) {
    console.error("Choose either --code-only or --backend, not both.");
    process.exit(2);
  }
  if (hasFlag(extra, "--code-only")) {
    return { args: extra, autoClaude: false, backend: null };
  }
  if (hasFlag(extra, "--backend")) {
    const inline = extra.find((arg) => arg.startsWith("--backend="));
    const index = extra.indexOf("--backend");
    const backend = inline?.slice("--backend=".length)
      || (index >= 0 ? extra[index + 1] : null);
    return { args: extra, autoClaude: false, backend };
  }
  const forcedCodeOnly = /^(1|true|yes)$/i.test(process.env.GRAPHIFY_CODE_ONLY || "");
  const claudeCommand = process.platform === "win32" ? "claude.cmd" : "claude";
  if (!forcedCodeOnly && commandAvailable(claudeCommand)) {
    console.log("[graphify wrapper] Claude CLI found; semantically extracting useful documentation.");
    return {
      args: ["--backend", "claude-cli", "--max-concurrency", "1", ...extra],
      autoClaude: true,
      backend: "claude-cli",
    };
  }
  console.log("[graphify wrapper] Claude CLI unavailable or disabled; using deterministic code-only extraction.");
  return {
    args: ["--code-only", ...extra],
    autoClaude: false,
    backend: null,
  };
}

function showStatus() {
  if (!fs.existsSync(graphPath)) {
    console.log("Graph status: absent (optional; ordinary development is unaffected).");
    console.log("Build with: npm run graph:build");
    return;
  }
  const graph = parseJson(graphPath);
  if (!graph) {
    console.log("Graph status: present but unreadable; use source directly and rebuild when practical.");
    return;
  }
  const dirty = dirtySourceFiles();
  const state = currentState(graph, dirty);
  const stats = graphStats(graph);
  const metadata = parseJson(metadataPath);
  console.log(`Graph status: ${state.current ? "current" : "may be stale"}`);
  console.log(`Nodes / edges / communities: ${stats.nodeCount} / ${stats.edgeCount} / ${stats.communityCount}`);
  console.log(`Graph commit: ${state.builtAt || "not recorded"}`);
  console.log(`Current commit: ${state.head || "unknown"}`);
  console.log(`Tracked/untracked source changes: ${dirty.length}`);
  console.log(`Needs-update marker: ${state.updateFlag ? "present" : "absent"}`);
  console.log(`Manifest: ${fs.existsSync(manifestPath) ? "present" : "missing"}`);
  console.log(`HTML / report: ${fs.existsSync(path.join(outputDir, "graph.html")) ? "yes" : "no"} / ${fs.existsSync(path.join(outputDir, "GRAPH_REPORT.md")) ? "yes" : "no"}`);
  if (metadata) {
    console.log(`Graphify: ${metadata.graphifyVersion || "unknown"} via ${metadata.installationMechanism || "unknown"}`);
    console.log(`Included / skipped files: ${metadata.includedFileCount ?? "unknown"} / ${metadata.skippedFileCount ?? "unknown"}`);
    console.log(`Last recorded duration: ${metadata.generationDurationSeconds ?? "unknown"}s`);
  }
}

function validateIntegration(engine) {
  let okay = true;
  const checks = [
    [fs.existsSync(canonicalSkill), "canonical Claude skill exists"],
    [fs.existsSync(codexAdapter), "Codex skill adapter exists"],
    [
      fs.existsSync(codexAdapter)
        && fs.readFileSync(codexAdapter, "utf8").includes(
          "CANONICAL_GRAPHIFY_SKILL=../../../.claude/skills/graphify/SKILL.md",
        ),
      "Codex adapter points to the canonical skill",
    ],
    [fs.existsSync(path.join(repoRoot, ".graphifyignore")), ".graphifyignore exists"],
  ];
  const ignored = run(
    "git", ["check-ignore", "--no-index", "--quiet", "graphify-out/probe.json"],
    { encoding: "utf8" },
  ).status === 0;
  checks.push([ignored, "graphify-out/ is ignored"]);
  for (const [passed, label] of checks) {
    console.log(`${passed ? "PASS" : "FAIL"}: ${label}`);
    okay &&= passed;
  }
  const version = graphifyVersion(engine);
  const versionOkay = version === EXPECTED_VERSION;
  console.log(`${versionOkay ? "PASS" : "WARN"}: Graphify ${version} (workflow verified with ${EXPECTED_VERSION})`);
  return okay;
}

function usage() {
  console.log(`Usage: node scripts/graphify.mjs <command> [arguments]

Commands:
  build [flags]             full extract . --force rebuild
  update [flags]            incremental local AST update
  query [--dfs] "question"  bounded graph traversal (default budget: 1600)
  path "node A" "node B"    shortest path
  explain "node"            node and neighbor explanation
  status                    local graph freshness and statistics
  check                     integration checks + Graphify check-update
  watch [flags]             watch source changes
  cluster [flags]           rerun clustering/report generation`);
}

const [command = "help", ...extra] = process.argv.slice(2);
ensureLocalOutputArgs(extra);

if (command === "help" || command === "--help" || command === "-h") {
  usage();
  process.exit(0);
}
if (command === "status") {
  showStatus();
  process.exit(0);
}

const engine = requireEngine();
const dirtyBefore = dirtySourceFiles();
const start = process.hrtime.bigint();
let graphifyArgs;
let extractionMode;

switch (command) {
  case "build": {
    const buildPlan = semanticBuildArgs(extra);
    graphifyArgs = ["extract", ".", "--force", ...buildPlan.args];
    extractionMode = graphifyArgs.includes("--code-only")
      ? "full AST code-only"
      : "full AST + semantic documentation";
    let exitCode = invoke(engine, graphifyArgs);
    if (exitCode !== 0 && buildPlan.autoClaude) {
      console.warn(
        "[graphify wrapper] Claude CLI extraction failed; retrying a deterministic code-only full build.",
      );
      graphifyArgs = ["extract", ".", "--force", "--code-only", ...extra];
      extractionMode = "full AST code-only fallback";
      exitCode = invoke(engine, graphifyArgs);
    }
    if (exitCode !== 0) process.exit(exitCode);

    const extractionTokens = analysisTokenUsage();
    const clusterArgs = ["cluster-only", "."];
    if (buildPlan.backend && extractionMode !== "full AST code-only fallback") {
      clusterArgs.push("--backend", buildPlan.backend);
    }
    let clusterExit = invoke(engine, clusterArgs);
    if (clusterExit !== 0 && buildPlan.backend) {
      console.warn(
        "[graphify wrapper] Semantic community labeling failed; retrying deterministic clustering.",
      );
      clusterExit = invoke(engine, ["cluster-only", "."]);
    }
    if (clusterExit !== 0) process.exit(clusterExit);

    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    recordMetadata({
      engine,
      durationSeconds,
      extractionMode,
      operation: command,
      dirtyBefore,
      measuredTokens: combinedTokenUsage(
        extractionTokens,
        reportTokenUsage(),
      ),
    });
    process.exit(0);
    break;
  }
  case "update":
    requireGraph();
    graphifyArgs = ["update", ".", ...extra];
    extractionMode = "incremental AST";
    break;
  case "query":
    requireGraph();
    {
      const normalized = normalizeQueryArgs(extra);
      graphifyArgs = [
        "query", normalized.question, ...normalized.options,
        ...(normalized.hasBudget ? [] : ["--budget", "1600"]),
        "--graph", graphPath,
      ];
    }
    break;
  case "path":
    requireGraph();
    if (extra.filter((arg) => !arg.startsWith("-")).length < 2) {
      console.error("Provide two quoted node labels after `--`.");
      process.exit(2);
    }
    graphifyArgs = ["path", ...extra, "--graph", graphPath];
    break;
  case "explain":
    requireGraph();
    if (extra.length === 0 || extra.some((arg) => arg.startsWith("-"))) {
      console.error("Provide a quoted node label after `--`.");
      process.exit(2);
    }
    graphifyArgs = ["explain", extra.join(" "), "--graph", graphPath];
    break;
  case "watch":
    graphifyArgs = ["watch", ".", ...extra];
    break;
  case "cluster":
    requireGraph();
    graphifyArgs = ["cluster-only", ".", "--graph", graphPath, ...extra];
    extractionMode = "cluster-only";
    break;
  case "check": {
    const valid = validateIntegration(engine);
    if (fs.existsSync(graphPath)) {
      const exitCode = invoke(engine, ["check-update", "."]);
      showStatus();
      process.exit(valid && exitCode === 0 ? 0 : 1);
    }
    showStatus();
    process.exit(valid ? 0 : 1);
  }
  break;
  default:
    usage();
    process.exit(2);
}

const exitCode = invoke(engine, graphifyArgs);
const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
if (exitCode === 0 && ["build", "update", "cluster"].includes(command)) {
  recordMetadata({
    engine,
    durationSeconds,
    extractionMode,
    operation: command,
    dirtyBefore,
    measuredTokens: command === "cluster"
      ? combinedTokenUsage(null, reportTokenUsage())
      : null,
  });
}
process.exit(exitCode);
