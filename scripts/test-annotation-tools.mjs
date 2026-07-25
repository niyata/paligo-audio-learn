/**
 * Contract tests for the shared Paligo annotation layer.
 *
 * Run:
 *   node scripts/test-annotation-tools.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const storage = new Map();
const sandbox = {
  window: {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
  },
};
sandbox.window.window = sandbox.window;

const source = await readFile("paligo-annotation-tools.js", "utf8");
vm.runInNewContext(source, sandbox, { filename: "paligo-annotation-tools.js" });

const PAT = sandbox.window.PaligoAnnotationTools;
assert.equal(PAT.SCHEMA, "paligo.annotation.v1");

const session = PAT.init({
  host: "pip",
  contextProvider: () => ({
    courseId: "pt4",
    subjectId: "thai-to-pali",
    corpusId: "dhammapadatthakatha-book1",
    manifestPath: "data/corpora/dhammapadatthakatha-pali-rtf-prototype/manifest.json",
    pageId: "page-3",
    sourcePage: "3",
    lineId: "p3-line-8",
  }),
});

const context = session.context();
assert.equal(context.surface, "pip");
assert.equal(context.courseId, "pt4");
assert.equal(context.subjectId, "thai-to-pali");
assert.equal(context.corpusId, "dhammapadatthakatha-book1");
assert.match(context.contextKey, /^paligo\.annotations\.v1:pt4:thai-to-pali:dhammapadatthakatha-book1:records$/);

const annotation = session.createAnnotation({
  selection: {
    text: "ธมฺโม",
    selectionStart: 10,
    selectionEnd: 15,
  },
  tool: {
    type: "grammar-tag",
    presetId: "pt4-pali-grammar",
    id: "b-p",
  },
  data: {
    label: "ป.",
  },
});

assert.equal(annotation.schema, "paligo.annotation.v1");
assert.equal(annotation.surface, "pip");
assert.equal(annotation.selection.text, "ธมฺโม");
assert.equal(annotation.selection.startOffset, 10);
assert.equal(annotation.tool.type, "grammar-tag");
assert.equal(annotation.tool.tagId, "b-p");
assert.equal(annotation.data.label, "ป.");

const adapter = session.storage();
adapter.write([annotation]);
assert.equal(adapter.read().length, 1);

const otherContext = PAT.context.normalize({
  courseId: "pt4",
  subjectId: "pali-to-thai",
  corpusId: "mangalattha-pali-pathamo",
});
assert.notEqual(context.contextKey, otherContext.contextKey);

console.log("Annotation tools contracts passed");
