#!/usr/bin/env node
/**
 * Validate corpus lexical-alignment contracts before lookup ships broadly.
 *
 * This audit is intentionally strict about references and status, but it does
 * not require full-book coverage yet. Seed files are allowed when explicitly
 * marked as seed and human-review pending.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CORPUS_ROOT = path.join(ROOT, "data", "corpora");
const ALIGNMENT_SCHEMA = "paligo.lexical-alignment.v1";
const ALIGNMENT_REF_SCHEMA = "paligo.lexical-alignment.ref.v1";
const ALLOWED_CONFIDENCE = new Set(["seed", "machine", "human_reviewed", "human_verified"]);
const ALLOWED_REVIEW_STATUS = new Set(["needs_human_review", "reviewed", "verified"]);

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
}

async function findManifestFiles(dir = CORPUS_ROOT) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findManifestFiles(absolute));
    } else if (entry.name === "manifest.json") {
      files.push(absolute);
    }
  }
  return files.sort();
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function assertToken(token, index, errors) {
  const prefix = `tokenIndex[${index}]`;
  assert(typeof token.tokenId === "string" && token.tokenId.length > 0, `${prefix}: missing tokenId`, errors);
  assert(typeof token.corpusId === "string" && token.corpusId.length > 0, `${prefix}: missing corpusId`, errors);
  assert(typeof token.itemId === "string" && token.itemId.length > 0, `${prefix}: missing itemId`, errors);
  assert(Number.isInteger(token.sourcePage), `${prefix}: sourcePage must be an integer`, errors);
  assert(Number.isInteger(token.lineNo), `${prefix}: lineNo must be an integer`, errors);
  assert(Number.isInteger(token.tokenNo), `${prefix}: tokenNo must be an integer`, errors);
  assert(["pali", "thai"].includes(token.language), `${prefix}: language must be pali or thai`, errors);
  assert(typeof token.surface === "string" && token.surface.trim().length > 0, `${prefix}: missing surface`, errors);
  assert(typeof token.normalized === "string" && token.normalized.trim().length > 0, `${prefix}: missing normalized`, errors);
}

function assertAlignment(alignment, index, tokenIds, errors) {
  const prefix = `alignments[${index}]`;
  assert(typeof alignment.alignmentId === "string" && alignment.alignmentId.length > 0, `${prefix}: missing alignmentId`, errors);
  assert(Array.isArray(alignment.sourceTokenIds) && alignment.sourceTokenIds.length > 0, `${prefix}: missing sourceTokenIds`, errors);
  assert(Array.isArray(alignment.targetTokenIds) && alignment.targetTokenIds.length > 0, `${prefix}: missing targetTokenIds`, errors);
  assert(["pali", "thai"].includes(alignment.sourceLanguage), `${prefix}: invalid sourceLanguage`, errors);
  assert(["pali", "thai"].includes(alignment.targetLanguage), `${prefix}: invalid targetLanguage`, errors);
  assert(typeof alignment.type === "string" && alignment.type.length > 0, `${prefix}: missing type`, errors);
  assert(ALLOWED_CONFIDENCE.has(alignment.confidence), `${prefix}: invalid confidence`, errors);
  assert(ALLOWED_REVIEW_STATUS.has(alignment.reviewStatus), `${prefix}: invalid reviewStatus`, errors);

  for (const id of [...(alignment.sourceTokenIds || []), ...(alignment.targetTokenIds || [])]) {
    assert(tokenIds.has(id), `${prefix}: unknown tokenId ${id}`, errors);
  }
}

async function auditAlignment(manifestFile, manifest, reports) {
  const ref = manifest.lexicalAlignment;
  if (!ref) return;

  const errors = [];
  assert(ref.schema === ALIGNMENT_REF_SCHEMA, `${manifestFile}: lexicalAlignment.schema must be ${ALIGNMENT_REF_SCHEMA}`, errors);
  assert(typeof ref.alignmentSet === "string" && ref.alignmentSet.endsWith(".json"), `${manifestFile}: lexicalAlignment.alignmentSet must be a JSON path`, errors);
  assert(["seed", "machine", "human_reviewed", "human_verified"].includes(ref.status), `${manifestFile}: lexicalAlignment.status invalid`, errors);
  assert(Array.isArray(ref.lookupDirections) && ref.lookupDirections.includes("pali-to-thai") && ref.lookupDirections.includes("thai-to-pali"), `${manifestFile}: lookupDirections must include both directions`, errors);

  if (errors.length) {
    reports.push({ manifestFile, ok: false, errors });
    return;
  }

  const alignmentFile = path.resolve(path.dirname(manifestFile), ref.alignmentSet);
  const alignment = await readJson(alignmentFile);
  assert(alignment.schema === ALIGNMENT_SCHEMA, `${alignmentFile}: schema must be ${ALIGNMENT_SCHEMA}`, errors);
  assert(typeof alignment.alignmentSetId === "string" && alignment.alignmentSetId.length > 0, `${alignmentFile}: missing alignmentSetId`, errors);
  assert(["seed", "machine", "human_reviewed", "human_verified"].includes(alignment.status), `${alignmentFile}: invalid status`, errors);
  assert(alignment.source?.corpusId === manifest.corpusId || typeof alignment.source?.corpusId === "string", `${alignmentFile}: missing source corpusId`, errors);
  assert(alignment.source?.language === "pali", `${alignmentFile}: current production contract expects pali source`, errors);
  assert(Array.isArray(alignment.targets) && alignment.targets.length > 0, `${alignmentFile}: missing targets`, errors);
  assert(Array.isArray(alignment.tokenIndex) && alignment.tokenIndex.length > 0, `${alignmentFile}: missing tokenIndex`, errors);
  assert(Array.isArray(alignment.alignments) && alignment.alignments.length > 0, `${alignmentFile}: missing alignments`, errors);

  const tokenIds = new Set();
  for (const [index, token] of (alignment.tokenIndex || []).entries()) {
    assertToken(token, index, errors);
    if (token.tokenId) {
      assert(!tokenIds.has(token.tokenId), `tokenIndex[${index}]: duplicate tokenId ${token.tokenId}`, errors);
      tokenIds.add(token.tokenId);
    }
  }

  for (const [index, item] of (alignment.alignments || []).entries()) {
    assertAlignment(item, index, tokenIds, errors);
  }

  reports.push({
    manifestFile: path.relative(ROOT, manifestFile),
    alignmentFile: path.relative(ROOT, alignmentFile),
    ok: errors.length === 0,
    tokenCount: alignment.tokenIndex?.length || 0,
    alignmentCount: alignment.alignments?.length || 0,
    status: alignment.status,
    errors,
  });
}

const manifestFiles = await findManifestFiles();
const reports = [];

for (const manifestFile of manifestFiles) {
  const manifest = await readJson(manifestFile);
  await auditAlignment(manifestFile, manifest, reports);
}

const linkedReports = reports.filter((report) => report.alignmentFile || !report.ok);
const failed = linkedReports.filter((report) => !report.ok);

console.log(JSON.stringify({
  schema: "paligo.lexicalAlignment.audit.v1",
  checkedAt: new Date().toISOString(),
  manifestCount: manifestFiles.length,
  linkedAlignmentCount: linkedReports.length,
  reports: linkedReports,
  status: failed.length ? "failed" : "passed",
}, null, 2));

if (failed.length) {
  process.exit(1);
}
