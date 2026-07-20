/**
 * Paligo Reference Worker
 * Keeps corpus indexing, tokenization, search, and breadcrumb filtering off the
 * PiP main thread. The PiP page keeps a synchronous fallback for file:// and
 * older browsers, so this worker is an acceleration layer.
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
  const PUNCT_SPLIT = /[\s,;:.\u0e2f\u0e5a\u0e5b\[\]()「」『』\-–—]+/u;
  const corpora = new Map();

  const normalizePali = (value) =>
    String(value ?? "").replace(/[\uF700\uF70F\uF71A\uF710\uF701-\uF704\uF712\uF709\uF711]/g, (ch) => LEGACY_GLYPH_MAP[ch] || ch);

  const tokenizeText = (text) =>
    normalizePali(text)
      .split(PUNCT_SPLIT)
      .map((token) => token.trim())
      .filter(Boolean);

  const simpleHash = (value) => {
    let hash = 0;
    String(value || '').split('').forEach((char) => {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      hash |= 0;
    });
    return Math.abs(hash).toString(36);
  };

  const pagesFrom = (corpus) => (corpus?.items || []).filter((item) => item.itemType === 'page');

  const textForLine = (line, preferred = 'auto') => {
    if (!line) return '';
    if (preferred === 'thaiMeaning') return line.thaiMeaning || line.thai || line.text || '';
    if (preferred === 'thaiLiteral') return line.thaiLiteral || line.thai || line.text || '';
    if (preferred === 'thai') return line.thai || line.thaiMeaning || line.thaiLiteral || line.text || '';
    if (preferred === 'pali') return line.pali || line.text || '';
    return line.pali || line.thai || line.thaiMeaning || line.thaiLiteral || line.text || '';
  };

  const pageText = (page, preferred = 'auto') => {
    if (!page) return '';
    const direct = textForLine(page, preferred);
    if (direct) return direct;
    return (page.children || []).map((line) => textForLine(line, preferred)).filter(Boolean).join('\n');
  };

  const isTopicHeading = (text) => /^\[[^\]]{2,}\]$/.test(String(text || '').trim());
  const isBookPageHeading = (text) => /^พระธัมมปทัฏฐกถา.*หน้า\s*[๐-๙0-9]+$/u.test(String(text || '').trim());
  const isVaggaHeading = (text) => {
    const value = String(text || '').trim();
    return /^[๐-๙0-9]+\.\s+.+วรรค\s+วรรณนา$/u.test(value)
      || /^[๐-๙0-9]+\.\s+.+วคฺค.*วณฺณนา$/u.test(value);
  };
  const isStoryHeading = (text) => {
    const value = String(text || '').trim();
    return /^[๐-๙0-9]+\.\s+เรื่อง/u.test(value)
      || /^[๐-๙0-9]+\.\s+.+ตฺเถรวตฺถุ/u.test(value);
  };
  const normalizeBreadcrumbText = (text) => {
    let value = String(text || '')
      .replace(/^พระธัมมปทัฏฐกถาแปล\s*/u, 'ธัมมปทัฏฐกถาแปล ')
      .trim();
    if (isTopicHeading(value)) value = value.replace(/^\[|\]$/g, '');
    return value.replace(/\s*\[\s*[๐-๙0-9]+\s*\]$/u, '').trim();
  };
  const breadcrumbKey = (label, kind = '') => `${kind || 'crumb'}:${simpleHash(label)}`;

  const buildPageIndex = (corpus) => {
    const pages = pagesFrom(corpus);
    const bySourcePage = new Map();
    const byItemId = new Map();
    pages.forEach((page) => {
      if (page.itemId) byItemId.set(String(page.itemId), page);
      if (page.sourcePage != null) bySourcePage.set(String(page.sourcePage), page);
    });
    return { pages, bySourcePage, byItemId };
  };

  const buildReferenceGroups = (corpus, preferredLanguage = 'auto') => {
    const { pages } = buildPageIndex(corpus);
    const groups = [];
    let active = null;
    let activeStory = null;
    pages.forEach((page) => {
      (page.children || []).forEach((line) => {
        const text = textForLine(line, preferredLanguage);
        if (!text) return;
        const label = normalizeBreadcrumbText(text);
        if (isVaggaHeading(text)) {
          active = {
            key: breadcrumbKey(label, 'vagga'),
            label,
            sourcePage: page.sourcePage,
            sourcePageLabel: page.sourcePageLabel,
            stories: [],
          };
          activeStory = null;
          groups.push(active);
          return;
        }
        if (active && isStoryHeading(text)) {
          const storyLabel = normalizeBreadcrumbText(text);
          activeStory = active.stories.find((story) => story.label === storyLabel) || null;
          if (!activeStory) {
            activeStory = {
              key: breadcrumbKey(storyLabel, 'story'),
              label: storyLabel,
              groupKey: active.key,
              pageId: page.itemId,
              sourcePage: page.sourcePage,
              sourcePageLabel: page.sourcePageLabel,
              topics: [],
            };
            active.stories.push(activeStory);
          }
          return;
        }
        if (activeStory && isTopicHeading(text)) {
          const topicLabel = normalizeBreadcrumbText(text);
          if (!activeStory.topics.some((topic) => topic.label === topicLabel)) {
            activeStory.topics.push({
              key: breadcrumbKey(topicLabel, 'topic'),
              label: topicLabel,
              topicId: line?.itemId ? `topic-${line.itemId}` : '',
              pageId: page.itemId,
              sourcePage: page.sourcePage,
              sourcePageLabel: page.sourcePageLabel,
              lineNo: line.itemNo,
            });
          }
        }
      });
    });
    return groups;
  };

  const registerCorpus = ({ corpusKey, corpus, preferredLanguage = 'auto' }) => {
    if (!corpusKey || !corpus) return { ok: false, reason: 'missing corpusKey or corpus' };
    const index = buildPageIndex(corpus);
    corpora.set(corpusKey, {
      corpus,
      index,
      groups: new Map([[preferredLanguage, buildReferenceGroups(corpus, preferredLanguage)]]),
    });
    return {
      ok: true,
      corpusKey,
      pageCount: index.pages.length,
      sourcePages: index.pages.map((page) => page.sourcePage),
    };
  };

  const corpusState = (corpusKey) => {
    const state = corpora.get(corpusKey);
    if (!state) throw new Error(`ไม่พบ corpus worker key: ${corpusKey}`);
    return state;
  };

  const pageFor = (state, sourcePage) =>
    state.index.bySourcePage.get(String(sourcePage)) || state.index.byItemId.get(String(sourcePage)) || null;

  const pageTokens = ({ corpusKey, sourcePage, preferredLanguage = 'auto' }) => {
    const state = corpusState(corpusKey);
    return {
      sourcePage,
      tokens: tokenizeText(pageText(pageFor(state, sourcePage), preferredLanguage)),
    };
  };

  const search = ({ corpusKey, query, preferredLanguage = 'auto', limit = 40 }) => {
    const state = corpusState(corpusKey);
    const needle = normalizePali(query || '').trim().toLowerCase();
    if (!needle) return [];
    const hits = [];
    for (const page of state.index.pages) {
      for (const line of page.children || []) {
        const text = textForLine(line, preferredLanguage);
        if (!normalizePali(text).toLowerCase().includes(needle)) continue;
        hits.push({
          itemId: line.itemId,
          sourcePage: line.sourcePage || page.sourcePage,
          sourcePageLabel: line.sourcePageLabel || page.sourcePageLabel,
          lineNo: line.itemNo,
          text: String(text).slice(0, 240),
        });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  };

  const referenceGroups = ({ corpusKey, preferredLanguage = 'auto' }) => {
    const state = corpusState(corpusKey);
    if (!state.groups.has(preferredLanguage)) {
      state.groups.set(preferredLanguage, buildReferenceGroups(state.corpus, preferredLanguage));
    }
    return state.groups.get(preferredLanguage);
  };

  const filterReference = ({ corpusKey, preferredLanguage = 'auto', lookupKey = '' }) => {
    const groups = referenceGroups({ corpusKey, preferredLanguage });
    if (lookupKey === 'story:all') {
      return {
        kind: 'all-stories',
        label: 'ทุกเรื่องในเล่ม',
        items: groups.flatMap((group) => group.stories || []),
      };
    }
    const group = groups.find((entry) => entry.key === lookupKey) || null;
    if (group) {
      return {
        kind: 'group',
        label: group.label,
        items: group.stories || [],
      };
    }
    const story = groups.flatMap((entry) => entry.stories || []).find((entry) => entry.key === lookupKey) || null;
    if (story) {
      return {
        kind: 'story',
        label: story.label,
        items: story.topics || [],
      };
    }
    return { kind: 'empty', label: '', items: [] };
  };

  self.addEventListener('message', (event) => {
    const { id, type, payload = {} } = event.data || {};
    try {
      let result;
      if (type === 'register-corpus') result = registerCorpus(payload);
      else if (type === 'page-tokens') result = pageTokens(payload);
      else if (type === 'search') result = search(payload);
      else if (type === 'reference-groups') result = referenceGroups(payload);
      else if (type === 'filter-reference') result = filterReference(payload);
      else throw new Error(`Unknown reference worker message: ${type}`);
      self.postMessage({ id, ok: true, result });
    } catch (error) {
      self.postMessage({ id, ok: false, error: error?.message || String(error) });
    }
  });
})();
