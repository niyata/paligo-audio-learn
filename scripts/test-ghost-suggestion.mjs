#!/usr/bin/env node
/**
 * Contract tests for Paligo Ghost Suggestion token filtering.
 *
 * Run:
 *   node scripts/test-ghost-suggestion.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sandbox = { window: {} };
const source = await readFile("paligo-ghost-suggestion.js", "utf8");
vm.runInNewContext(source, sandbox, { filename: "paligo-ghost-suggestion.js" });

const ghost = sandbox.window.PaligoGhostSuggestion;
assert.equal(typeof ghost?.suggestNextTokens, "function");
assert.equal(typeof ghost?.filterGhostSuggestionTokens, "function");

const nodeArray = (value) => Array.from(value || []);

assert.deepEqual(
  nodeArray(ghost.filterGhostSuggestionTokens(["๑", "๒๒", "จกฺขุปาลตฺเถร", "วตฺถุ"], { focus: "pali" })),
  ["จกฺขุปาลตฺเถร", "วตฺถุ"]
);

assert.deepEqual(
  nodeArray(ghost.filterGhostSuggestionTokens(["๑", "พระศาสดา", "มงฺคลํ", "ภาค"], { focus: "thai" })),
  ["พระศาสดา"]
);

assert.deepEqual(
  nodeArray(ghost.suggestNextTokens({
    typedPrefix: "",
    answerTokens: ["๑", "จกฺขุปาลตฺเถร", "วตฺถุ"],
    completedTokens: [],
    focus: "pali",
  })),
  ["จกฺขุปาลตฺเถร", "วตฺถุ"]
);

assert.deepEqual(
  nodeArray(ghost.suggestNextTokens({
    typedPrefix: "๑",
    answerTokens: ["๑", "จกฺขุปาลตฺเถร"],
    completedTokens: [],
    focus: "pali",
  })),
  []
);

console.log("Ghost suggestion contracts passed");
