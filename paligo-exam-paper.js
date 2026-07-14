/**
 * Shared ruled-paper review layer — stamp, highlight, signature overlays
 */
(function () {
  const ERROR_LABELS = {
    "wrong-word": "ผิดศัพท์",
    "wrong-relation": "ผิดสัมพันธ์",
    "wrong-pa": "ผิด ป.",
  };

  const SCORE_LABELS = {
    "score-1": "๑ ให้",
    "score-2": "๒ ให้",
    "score-3": "๓ ให้",
  };

  const REVIEW_LABELS = {
    ...ERROR_LABELS,
    ...SCORE_LABELS,
  };

  const HIGHLIGHT_COLORS = {
    "score-1": "rgba(36, 113, 91, 0.2)",
    "score-2": "rgba(36, 113, 91, 0.28)",
    "score-3": "rgba(36, 113, 91, 0.36)",
    "wrong-word": "rgba(255, 214, 0, 0.42)",
    "wrong-relation": "rgba(255, 159, 64, 0.42)",
    "wrong-pa": "rgba(255, 107, 107, 0.38)",
  };

  function displayPageToIndex(page) {
    return Math.max(0, Number(page || 1) - 1);
  }

  function indexToDisplayPage(pageIndex) {
    return pageIndex + 1;
  }

  function getLineHeight() {
    return (
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--line-height").trim()) ||
      30
    );
  }

  function getMaxLines(pageIndex, linesFirstPage, linesPerPage) {
    return pageIndex === 0 ? linesFirstPage : linesPerPage;
  }

  function lineFromPointer(event, editor, maxLines) {
    const lineHeight = getLineHeight();
    const editorRect = editor.getBoundingClientRect();
    const relativeY = event.clientY - editorRect.top;
    const lineN = Math.ceil(relativeY / lineHeight);
    if (lineN < 1 || lineN > maxLines) return null;
    return lineN;
  }

  function lineFromSelectionStart(editor) {
    const start = editor.selectionStart ?? 0;
    const textBefore = editor.value.substring(0, start);
    return Math.max(1, textBefore.split("\n").length);
  }

  function createHighlightId() {
    const random =
      typeof crypto !== "undefined" && crypto.randomUUID?.()
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `hl-${random}`;
  }

  function renderReviewLayerForPage(
    container,
    pageIndex,
    { scoreStamps, errorStamps, textHighlights, signature },
    { onHighlightClick } = {}
  ) {
    if (!container) return;
    container.innerHTML = "";

    (scoreStamps || [])
      .filter((stamp) => displayPageToIndex(stamp.page) === pageIndex)
      .forEach((stamp) => {
        const el = document.createElement("div");
        el.className = "review-stamp-overlay is-score";
        el.style.setProperty("--line-n", String(stamp.line));
        el.textContent = `${window.PaligoExamShared?.toThaiNumber(stamp.value) || stamp.value} ให้`;
        container.append(el);
      });

    (errorStamps || [])
      .filter((stamp) => displayPageToIndex(stamp.page) === pageIndex)
      .forEach((stamp) => {
        const el = document.createElement("div");
        el.className = "review-stamp-overlay is-error";
        el.style.setProperty("--line-n", String(stamp.line));
        el.textContent = ERROR_LABELS[stamp.kind] || stamp.kind;
        container.append(el);
      });

    (textHighlights || [])
      .filter((item) => displayPageToIndex(item.page) === pageIndex)
      .forEach((item) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `review-highlight-mark is-${item.kind}`;
        el.style.setProperty("--line-n", String(item.line));
        el.style.setProperty("--hl-bg", HIGHLIGHT_COLORS[item.kind] || HIGHLIGHT_COLORS["wrong-word"]);
        el.dataset.highlightId = item.id;
        el.title = `${REVIEW_LABELS[item.kind] || item.kind}: ${item.text || ""}`;
        el.innerHTML = `<span class="review-highlight-mark__bar" aria-hidden="true"></span><span class="review-highlight-mark__label">${REVIEW_LABELS[item.kind] || item.kind}</span><span class="review-highlight-mark__text">${item.text || ""}</span>`;
        if (typeof onHighlightClick === "function") {
          el.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            onHighlightClick(item);
          });
        }
        container.append(el);
      });

    if (signature?.dataUrl && displayPageToIndex(signature.page) === pageIndex) {
      const img = document.createElement("img");
      img.className = "review-signature-overlay";
      img.src = signature.dataUrl;
      img.alt = signature.label || "ลายเซ็นผู้ตรวจ";
      img.style.setProperty("--line-n", String(signature.line || 1));
      if (signature.widthPx) img.style.width = `${signature.widthPx}px`;
      container.append(img);
    }
  }

  function renderAllReviewLayers(examPages, reviewState, options = {}) {
    examPages.forEach((page, pageIndex) => {
      const container = page.querySelector("[data-review-layer]");
      renderReviewLayerForPage(container, pageIndex, reviewState, options);
    });
  }

  function bindReviewCanvas({
    canvas,
    pageIndex,
    linesFirstPage,
    linesPerPage,
    canStamp,
    onScoreStamp,
    onErrorStamp,
    getActiveStampKind,
  }) {
    if (!canvas || canvas.dataset.reviewBound === "true") return;
    canvas.dataset.reviewBound = "true";

    canvas.addEventListener("click", (event) => {
      if (!canStamp()) return;
      const frame = canvas.closest(".ruled-editor-frame");
      const editor = frame?.querySelector(".ruled-editor");
      if (!editor) return;

      const line = lineFromPointer(
        event,
        editor,
        getMaxLines(pageIndex, linesFirstPage, linesPerPage)
      );
      if (!line) return;

      const kind = getActiveStampKind();
      if (!kind) return;

      const page = indexToDisplayPage(pageIndex);
      if (kind === "score-1" || kind === "score-2" || kind === "score-3") {
        onScoreStamp({ page, line, value: Number(kind.split("-")[1]) });
      } else if (typeof onErrorStamp === "function") {
        onErrorStamp({ page, line, kind });
      }
    });
  }

  function bindHighlightSelection({ editor, pageIndex, isActive, onSelection }) {
    if (!editor || editor.dataset.highlightBound === "true") return;
    editor.dataset.highlightBound = "true";

    editor.addEventListener("mouseup", () => {
      if (!isActive()) return;
      const start = editor.selectionStart ?? 0;
      const end = editor.selectionEnd ?? 0;
      if (start === end) return;

      const text = editor.value.substring(Math.min(start, end), Math.max(start, end)).trim();
      if (!text) return;

      onSelection({
        page: indexToDisplayPage(pageIndex),
        line: lineFromSelectionStart(editor),
        start: Math.min(start, end),
        end: Math.max(start, end),
        text,
      });
    });
  }

  function upsertScoreStamp(stamps, nextStamp) {
    const list = stamps.slice();
    const index = list.findIndex(
      (item) => Number(item.page) === Number(nextStamp.page) && Number(item.line) === Number(nextStamp.line)
    );
    const payload = {
      kind: "score",
      value: nextStamp.value,
      page: nextStamp.page,
      line: nextStamp.line,
      createdAt: new Date().toISOString(),
    };
    if (index >= 0) list[index] = payload;
    else list.push(payload);
    return list;
  }

  function upsertErrorStamp(stamps, nextStamp) {
    const list = stamps.slice();
    const index = list.findIndex(
      (item) => Number(item.page) === Number(nextStamp.page) && Number(item.line) === Number(nextStamp.line)
    );
    const payload = {
      kind: nextStamp.kind,
      value: "",
      page: nextStamp.page,
      line: nextStamp.line,
      createdAt: new Date().toISOString(),
    };
    if (index >= 0) list[index] = payload;
    else list.push(payload);
    return list;
  }

  function upsertTextHighlight(highlights, nextHighlight) {
    const list = highlights.slice();
    const index = list.findIndex((item) => item.id === nextHighlight.id);
    const payload = {
      id: nextHighlight.id || createHighlightId(),
      page: nextHighlight.page,
      line: nextHighlight.line,
      start: nextHighlight.start,
      end: nextHighlight.end,
      text: nextHighlight.text,
      kind: nextHighlight.kind,
      createdAt: nextHighlight.createdAt || new Date().toISOString(),
    };
    if (index >= 0) list[index] = payload;
    else list.push(payload);
    return list;
  }

  function removeTextHighlight(highlights, highlightId) {
    return highlights.filter((item) => item.id !== highlightId);
  }

  window.PaligoExamPaper = {
    ERROR_LABELS,
    SCORE_LABELS,
    REVIEW_LABELS,
    HIGHLIGHT_COLORS,
    displayPageToIndex,
    indexToDisplayPage,
    lineFromPointer,
    lineFromSelectionStart,
    createHighlightId,
    renderAllReviewLayers,
    bindReviewCanvas,
    bindHighlightSelection,
    upsertScoreStamp,
    upsertErrorStamp,
    upsertTextHighlight,
    removeTextHighlight,
  };
})();
