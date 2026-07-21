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
    "\uF70B": "้",
    "\uF70E": "์",
    "\uF712": "็",
    "\uF718": "ุ",
    "\uF709": "์",
    "\uF711": "ํ",
  };

  const PUNCT_SPLIT = /[\s,;:.\u0e2f\u0e5a\u0e5b\[\]()「」『』「」\-–—]+/u;
  const MAX_SUGGESTIONS = 8;

  const normalizePali = (value) =>
    String(value ?? "").replace(/[\uF700\uF70F\uF71A\uF710\uF701-\uF704\uF70B\uF70E\uF712\uF718\uF709\uF711]/g, (ch) => LEGACY_GLYPH_MAP[ch] || ch);

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
      this._worker = null;
      this._workerReady = undefined;
      this._workerSeq = 0;
      this._workerCorpusSeq = 0;
      this._workerPending = new Map();
      this._workerKeys = new WeakMap();
      this._pageTokens = new WeakMap();
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

    _workerKeyForCorpus(corpus) {
      if (!corpus) return "";
      if (!this._workerKeys.has(corpus)) this._workerKeys.set(corpus, `ghost-corpus-${++this._workerCorpusSeq}`);
      return this._workerKeys.get(corpus);
    }

    _tokenCacheForCorpus(corpus) {
      if (!this._pageTokens.has(corpus)) this._pageTokens.set(corpus, new Map());
      return this._pageTokens.get(corpus);
    }

    _requestWorker(type, payload) {
      if (!this._worker) return Promise.reject(new Error("reference worker unavailable"));
      const id = `ghost-${++this._workerSeq}`;
      const promise = new Promise((resolve, reject) => {
        this._workerPending.set(id, { resolve, reject });
      });
      this._worker.postMessage({ id, type, payload });
      return promise;
    }

    _ensureWorker() {
      if (this._workerReady !== undefined) return this._workerReady;
      if (!("Worker" in window)) {
        this._workerReady = Promise.resolve(false);
        return this._workerReady;
      }
      try {
        this._worker = new Worker("paligo-reference-worker.js");
        this._worker.addEventListener("message", (event) => {
          const { id, ok, result, error } = event.data || {};
          const pending = this._workerPending.get(id);
          if (!pending) return;
          this._workerPending.delete(id);
          if (ok) pending.resolve(result);
          else pending.reject(new Error(error || "reference worker failed"));
        });
        this._worker.addEventListener("error", () => {
          this._workerPending.forEach((pending) => pending.reject(new Error("reference worker disabled")));
          this._workerPending.clear();
          this._worker?.terminate?.();
          this._worker = null;
          this._workerReady = Promise.resolve(false);
        });
        this._workerReady = Promise.resolve(true);
      } catch {
        this._worker = null;
        this._workerReady = Promise.resolve(false);
      }
      return this._workerReady;
    }

    async _registerCorpus(corpus, prefer) {
      const ready = await this._ensureWorker();
      if (!ready || !corpus) return "";
      const corpusKey = this._workerKeyForCorpus(corpus);
      await this._requestWorker("register-corpus", {
        corpusKey,
        corpus,
        preferredLanguage: prefer || "auto",
      });
      return corpusKey;
    }

    async tokensForPage(corpus, sourcePage, options = {}) {
      const prefer = options.prefer || "auto";
      const cacheKey = `${prefer}:${sourcePage}`;
      const tokenCache = this._tokenCacheForCorpus(corpus);
      if (tokenCache.has(cacheKey)) return tokenCache.get(cacheKey);
      try {
        const corpusKey = await this._registerCorpus(corpus, prefer);
        if (corpusKey) {
          const result = await this._requestWorker("page-tokens", { corpusKey, sourcePage, preferredLanguage: prefer });
          const tokens = result?.tokens || [];
          tokenCache.set(cacheKey, tokens);
          return tokens;
        }
      } catch {
        // Worker is an optimization only; keep ghost suggestion usable everywhere.
      }
      const tokens = pageTokensFromCorpus(corpus, sourcePage, options);
      tokenCache.set(cacheKey, tokens);
      return tokens;
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
