/**
 * Paligo deploy discipline checks.
 *
 * Run before pushing/deploying production candidate branches:
 *   node scripts/check-deploy-discipline.mjs
 */
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const [headers, robots, gitignore] = await Promise.all([
    readText("_headers"),
    readText("robots.txt"),
    readText(".gitignore"),
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

  console.log("Deploy discipline checks passed");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
