#!/usr/bin/env node
/**
 * Paligo production hardening runner.
 *
 * Default gates are offline-safe and suitable for local pre-push checks:
 *   node scripts/run-production-hardening.mjs
 *
 * Optional gates:
 *   PALIGO_RUN_VISUAL_AUDIT=1 node scripts/run-production-hardening.mjs
 *   PALIGO_RUN_LIVE_API_AUDIT=1 node scripts/run-production-hardening.mjs
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const node = process.execPath;
const optionalVisual = process.env.PALIGO_RUN_VISUAL_AUDIT === "1";
const optionalLiveApi = process.env.PALIGO_RUN_LIVE_API_AUDIT === "1";

const checks = [
  {
    name: "whitespace.diffCheck",
    command: "git",
    args: ["diff", "--check"],
  },
  ...[
    "paligo-inbox-client.js",
    "paligo-annotation-tools.js",
    "scripts/audit-live-api-readiness.mjs",
    "scripts/audit-lexical-alignment.mjs",
    "scripts/audit-pip-pali-glyphs.mjs",
    "scripts/audit-production-critical-pages.mjs",
    "scripts/check-deploy-discipline.mjs",
    "scripts/test-annotation-tools.mjs",
    "scripts/test-production-contracts.mjs",
    "workers/src/auth.js",
    "workers/src/db.js",
    "workers/src/http.js",
    "workers/src/inbox.js",
  ].map((file) => ({
    name: `syntax.${file}`,
    command: node,
    args: ["--check", file],
  })),
  {
    name: "contracts.appStateAndErrors",
    command: node,
    args: ["scripts/test-production-contracts.mjs"],
  },
  {
    name: "contracts.annotationTools",
    command: node,
    args: ["scripts/test-annotation-tools.mjs"],
  },
  {
    name: "corpus.paliGlyphNormalization",
    command: node,
    args: ["scripts/audit-pip-pali-glyphs.mjs"],
  },
  {
    name: "corpus.lexicalAlignment",
    command: node,
    args: ["scripts/audit-lexical-alignment.mjs"],
  },
  {
    name: "deploy.preLaunchDiscipline",
    command: node,
    args: ["scripts/check-deploy-discipline.mjs"],
  },
];

if (optionalVisual) {
  checks.push({
    name: "visual.productionCriticalPages",
    command: node,
    args: ["scripts/audit-production-critical-pages.mjs"],
  });
}

if (optionalLiveApi) {
  checks.push({
    name: "liveApi.appAndApiReadiness",
    command: node,
    args: ["scripts/audit-live-api-readiness.mjs"],
  });
}

function tail(text, maxLength = 3200) {
  if (!text || text.length <= maxLength) return text || "";
  return `...${text.slice(-maxLength)}`;
}

async function runCheck(check) {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(check.command, check.args, {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      name: check.name,
      ok: true,
      durationMs: Date.now() - startedAt,
      stdout: tail(stdout.trim()),
      stderr: tail(stderr.trim()),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      durationMs: Date.now() - startedAt,
      stdout: tail(error.stdout?.trim()),
      stderr: tail(error.stderr?.trim()),
      message: error.message,
      exitCode: error.code,
    };
  }
}

const report = {
  schema: "paligo.productionHardening.run.v1",
  startedAt: new Date().toISOString(),
  optional: {
    visualAudit: optionalVisual,
    liveApiAudit: optionalLiveApi,
  },
  checks: [],
};

for (const check of checks) {
  process.stdout.write(`▶ ${check.name}\n`);
  const result = await runCheck(check);
  report.checks.push(result);
  process.stdout.write(`${result.ok ? "✓" : "✕"} ${check.name} (${result.durationMs}ms)\n`);
  if (!result.ok) break;
}

report.finishedAt = new Date().toISOString();
report.status = report.checks.every((check) => check.ok) ? "passed" : "failed";

console.log(JSON.stringify(report, null, 2));

if (report.status !== "passed") {
  process.exit(1);
}
