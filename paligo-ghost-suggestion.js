/**
 * Paligo Ghost Suggestion — next-token hints from PiP answer page (thai-to-pali).
 * See docs/ghost-suggestion-prd.md
 */
(() => {
  const LEGACY_GLYPH_MAP = {
    "\uF700": "ฐ",
    "\uF70F": "ญ",
    "\uF71A": "ฺ",
    "\uF710": "ั",
    "\uF701": "ิ",
    "\uF702": "ี",
    "\uF703": "ึ",
    "\uF704": "ื",
    "\uF712": "็",
    "\uF709": "์",
    "\uF711": "ํ",
  };

  const PUNCT_SPLIT = /[\s,;:.\u0e2f\u0e5a\u0e5b\[\]()「」『』「」\-–—]+/u;
  const MAX_SUGGESTIONS = 8;

  const normalizePali = (value) =>
    String(value ?? "").replace(/[\uF700\uF70F\uF71A\uF710\uF701-\uF704\uF712\uF709\uF711]/g, (ch) => LEGACY_GLYPH_MAP[ch] || ch);

  const tokenizeAnswerText = (text) =>
    normalizePali(text)
      .split(PUNCT_SPLIT)
      .map((token) => token.trim())
      .filter(Boolean);

  const extractPageAnswerText = (page, { prefer = "auto" } = {}) => {
    if (!page) return "";
    const preferThai = prefer === "thai" || prefer === "thaiMeaning" || prefer === "thaiLiteral";
    if (preferThai) {
      if (page.thaiMeaning) return String(page.thaiMeaning);
      if (page.thai) return String(page.thai);
      if (page.thaiLiteral) return String(page.thaiLiteral);
      if (page.text && !page.pali) return String(page.text);
      const children = page.children || [];
      const thaiLines = children
        .map((line) => line.thaiMeaning || line.thai || line.thaiLiteral || "")
        .filter(Boolean);
      if (thaiLines.length) return thaiLines.join("\n");
    }
    if (page.pali) return String(page.pali);
    if (page.rawText) return String(page.rawText);
    if (page.text) return String(page.text);
    const children = page.children || [];
    return children
      .map((line) => line.pali || line.text || line.thaiMeaning || line.thai || "")
      .filter(Boolean)
      .join("\n");
  };

  const pageTokensFromCorpus = (corpus, sourcePage, options = {}) => {
    const pages = (corpus?.items || []).filter((item) => item.itemType === "page");
    const page =
      pages.find((item) => String(item.sourcePage) === String(sourcePage)) ||
      pages.find((item) => String(item.itemId) === String(sourcePage)) ||
      null;
    return tokenizeAnswerText(extractPageAnswerText(page, options));
  };

  const findNextTokenIndex = (completedTokens, answerTokens) => {
    const completed = completedTokens.map((token) => normalizePali(token));
    const answers = answerTokens.map((token) => normalizePali(token));
    if (!completed.length) return 0;

    for (let len = completed.length; len >= 1; len -= 1) {
      const suffix = completed.slice(-len);
      for (let start = 0; start <= answers.length - len; start += 1) {
        let match = true;
        for (let i = 0; i < len; i += 1) {
          if (suffix[i] !== answers[start + i]) {
            match = false;
            break;
          }
        }
        if (match) return start + len;
      }
    }
    return 0;
  };

  const uniquePush = (list, token, seen) => {
    const key = normalizePali(token);
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push(token);
  };

  /**
   * @param {{ typedPrefix: string, answerTokens: string[], completedTokens?: string[] }} args
   * @returns {string[]}
   */
  const suggestNextTokens = ({ typedPrefix, answerTokens, completedTokens = [] }) => {
    const answers = Array.isArray(answerTokens) ? answerTokens.filter(Boolean) : [];
    if (!answers.length) return [];

    const prefix = normalizePali(typedPrefix || "");
    const nextIndex = findNextTokenIndex(completedTokens, answers);
    const out = [];
    const seen = new Set();

    if (prefix) {
      const preferred = answers[nextIndex];
      if (preferred && normalizePali(preferred).startsWith(prefix)) {
        uniquePush(out, preferred, seen);
      }
      for (let i = nextIndex; i < answers.length && out.length < MAX_SUGGESTIONS; i += 1) {
        if (normalizePali(answers[i]).startsWith(prefix)) uniquePush(out, answers[i], seen);
      }
      for (let i = 0; i < answers.length && out.length < MAX_SUGGESTIONS; i += 1) {
        if (normalizePali(answers[i]).startsWith(prefix)) uniquePush(out, answers[i], seen);
      }
      return out.slice(0, MAX_SUGGESTIONS);
    }

    for (let i = nextIndex; i < Math.min(answers.length, nextIndex + 4) && out.length < MAX_SUGGESTIONS; i += 1) {
      uniquePush(out, answers[i], seen);
    }
    return out.slice(0, MAX_SUGGESTIONS);
  };

  const parseCaretTokenState = (textBeforeCaret) => {
    const normalized = normalizePali(textBeforeCaret || "");
    const match = normalized.match(/^(.*?)(\S*)$/su);
    const head = match?.[1] || "";
    const partial = match?.[2] || "";
    const completedTokens = tokenizeAnswerText(head).filter((token) => !/^[0-9๐-๙]+$/u.test(token));
    return { completedTokens, typedPrefix: partial };
  };

  class AnswerCorpusCache {
    constructor() {
      this._byUrl = new Map();
      this._inflight = new Map();
    }

    async loadCorpusJson(corpusJsonUrl) {
      const url = String(corpusJsonUrl || "");
      if (!url) return null;
      if (this._byUrl.has(url)) return this._byUrl.get(url);
      if (this._inflight.has(url)) return this._inflight.get(url);

      const promise = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`โหลด corpus ไม่สำเร็จ (${response.status})`);
          return response.json();
        })
        .then((corpus) => {
          this._byUrl.set(url, corpus);
          this._inflight.delete(url);
          return corpus;
        })
        .catch((error) => {
          this._inflight.delete(url);
          throw error;
        });

      this._inflight.set(url, promise);
      return promise;
    }

    tokensForPage(corpus, sourcePage) {
      return pageTokensFromCorpus(corpus, sourcePage);
    }
  }

  const defaultAnswerCorpusUrl = (corpusId) => {
    const id = String(corpusId || "").trim();
    if (!id) return "";
    return `data/corpora/${id}/corpus.json`;
  };

  window.PaligoGhostSuggestion = {
    normalizePali,
    tokenizeAnswerText,
    extractPageAnswerText,
    pageTokensFromCorpus,
    findNextTokenIndex,
    suggestNextTokens,
    parseCaretTokenState,
    AnswerCorpusCache,
    defaultAnswerCorpusUrl,
    MAX_SUGGESTIONS,
  };
})();
