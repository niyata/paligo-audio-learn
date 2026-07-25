/**
 * Paligo deploy discipline checks.
 *
 * Run before pushing/deploying production candidate branches:
 *   node scripts/check-deploy-discipline.mjs
 */
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function readText(path) {
  return readFile(path, "utf8");
}

async function gitConfigValue(key) {
  try {
    const { stdout } = await execFileAsync("git", ["config", "--get", key]);
    return stdout.trim();
  } catch {
    return "";
  }
}

async function commandExists(command, args = ["--version"]) {
  try {
    await execFileAsync(command, args);
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const [headers, robots, gitignore, lfsCleanConfig, hasGitLfs] = await Promise.all([
    readText("_headers"),
    readText("robots.txt"),
    readText(".gitignore"),
    gitConfigValue("filter.lfs.clean"),
    commandExists("git-lfs", ["version"]),
  ]);

  assert(
    /X-Robots-Tag:\s*noindex,\s*nofollow/i.test(headers),
    "_headers must keep X-Robots-Tag noindex,nofollow during pre-launch"
  );
  assert(
    /User-agent:\s*\*\s*[\r\n]+Disallow:\s*\//i.test(robots),
    "robots.txt must disallow all crawlers during pre-launch"
  );
  assert(
    /docs\/audit\/production-critical-pages\//.test(gitignore),
    ".gitignore must exclude generated visual smoke artifacts"
  );
  assert(
    !/git-lfs/i.test(lfsCleanConfig) || hasGitLfs || process.env.PALIGO_ALLOW_MISSING_GIT_LFS === "1",
    "Git LFS is configured for this repo but git-lfs is not available. Install git-lfs before production candidate push/deploy, or set PALIGO_ALLOW_MISSING_GIT_LFS=1 only for a documented emergency bypass."
  );

  console.log("Deploy discipline checks passed");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
