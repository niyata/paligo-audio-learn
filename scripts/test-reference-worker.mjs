#!/usr/bin/env node
/**
 * Contract tests for Paligo Reference Worker lookup/alignment APIs.
 *
 * Run:
 *   node scripts/test-reference-worker.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const listeners = new Map();
const messages = [];
const sandbox = {
  console,
  self: {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    postMessage(message) {
      messages.push(message);
    },
  },
};

const source = await readFile("paligo-reference-worker.js", "utf8");
vm.runInNewContext(source, sandbox, { filename: "paligo-reference-worker.js" });

const messageHandler = listeners.get("message");
assert.equal(typeof messageHandler, "function");

function workerRequest(type, payload) {
  const id = `test-${messages.length + 1}`;
  messageHandler({ data: { id, type, payload } });
  const message = messages.find((item) => item.id === id);
  assert(message, `missing worker response for ${type}`);
  if (!message.ok) throw new Error(message.error || `worker ${type} failed`);
  return message.result;
}

const alignment = JSON.parse(await readFile(
  "data/corpora/dhammapadatthakatha-pali-rtf-prototype/lexical-alignment.seed.json",
  "utf8",
));

const registered = workerRequest("register-alignment", {
  corpusKey: "dhammapada-seed",
  alignment,
});
assert.equal(registered.ok, true);
assert.equal(registered.tokenCount, 7);
assert.equal(registered.alignmentCount, 2);

const paliLookup = workerRequest("lookup-alignment", {
  corpusKey: "dhammapada-seed",
  query: "มโนเสฏฺฐา",
});
assert.equal(paliLookup.matches.length, 1);
assert.equal(paliLookup.matches[0].alignmentId, "aln-dhp-seed-0002");
assert.equal(paliLookup.matches[0].targetTokens.some((token) => token.surface === "มีใจเป็นใหญ่"), true);

const thaiLookup = workerRequest("lookup-alignment", {
  corpusKey: "dhammapada-seed",
  query: "มีใจเป็นหัวหน้า",
});
assert.equal(thaiLookup.matches.length, 1);
assert.equal(thaiLookup.matches[0].alignmentId, "aln-dhp-seed-0001");
assert.equal(thaiLookup.matches[0].sourceTokens.some((token) => token.surface === "มโนปุพฺพงฺคมา"), true);

console.log("Reference worker contracts passed");
