/**
 * Shared ruled-paper review layer — stamp + signature overlays
 */
(function () {
  const ERROR_LABELS = {
    "wrong-word": "ผิดศัพท์",
    "wrong-relation": "ผิดสัมพันธ์",
    "wrong-pa": "ผิด ป.",
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
      26
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

  function renderReviewLayerForPage(container, pageIndex, { scoreStamps, errorStamps, signature }) {
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

  function renderAllReviewLayers(examPages, reviewState) {
    examPages.forEach((page, pageIndex) => {
      const container = page.querySelector("[data-review-layer]");
      renderReviewLayerForPage(container, pageIndex, reviewState);
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
      } else {
        onErrorStamp({ page, line, kind });
      }
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

  window.PaligoExamPaper = {
    ERROR_LABELS,
    displayPageToIndex,
    indexToDisplayPage,
    lineFromPointer,
    renderAllReviewLayers,
    bindReviewCanvas,
    upsertScoreStamp,
    upsertErrorStamp,
  };
})();
