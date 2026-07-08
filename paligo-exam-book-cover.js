/**
 * Shared book cover rendering — ruled-paper cover for cards / flex messages
 */
(function (global) {
  const THAI_MONTH_NAMES = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];

  function getShared() {
    return global.PaligoExamShared || null;
  }

  function getPickerValue(book, type) {
    return book?.draft?.pickers?.find((item) => item.type === type)?.value || "";
  }

  function findSubjectOption(subjectOptions, { value, label } = {}) {
    if (value) {
      const byValue = subjectOptions.find((item) => item.value === String(value));
      if (byValue) return byValue;
    }
    if (label) {
      const normalized = String(label).trim();
      return subjectOptions.find((item) => item.label === normalized) || null;
    }
    return null;
  }

  function getSubjectLabel(book, shared) {
    const subjectOptions = shared.SUBJECT_OPTIONS || [];
    const direct = findSubjectOption(subjectOptions, {
      value: book?.subject || getPickerValue(book, "subject"),
      label: book?.subjectLabel,
    });
    if (direct) return direct.label;

    const titleParts = String(book?.title || "")
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of titleParts) {
      const fromTitle = findSubjectOption(subjectOptions, { label: part });
      if (fromTitle) return fromTitle.label;
    }
    return "แปลมคธเป็นไทย";
  }

  function formatCoverSubjectLine(label) {
    return `วิชา ${label || "แปลมคธเป็นไทย"}`;
  }

  function getCoverGrade(book) {
    return book?.grade || getPickerValue(book, "grade") || "-";
  }

  function getCoverDateLabel(book, toThaiNumber) {
    const day = getPickerValue(book, "day");
    const month = getPickerValue(book, "month");
    const year = getPickerValue(book, "year");
    if (day && month && year) {
      return `${toThaiNumber(day)} ${THAI_MONTH_NAMES[Number(month) - 1]} ${toThaiNumber(year)}`;
    }

    const titleParts = String(book?.title || "")
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);
    if (titleParts.length >= 3) {
      const maybeDate = titleParts[titleParts.length - 1];
      const subjectOptions = getShared()?.SUBJECT_OPTIONS || [];
      if (maybeDate && !findSubjectOption(subjectOptions, { label: maybeDate })) {
        return toThaiNumber(maybeDate);
      }
    }

    if (book?.updatedAt) {
      return toThaiNumber(
        new Date(book.updatedAt).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    }
    return "—";
  }

  /**
   * @param {object} book
   * @param {{ compact?: boolean, avatarUrl?: string, avatarName?: string }} [options]
   */
  function buildAvatarElement(avatarUrl, avatarName, compact) {
    const wrap = document.createElement("div");
    wrap.className = compact ? "book-cover-avatar is-compact" : "book-cover-avatar";
    const label = String(avatarName || "").trim();

    if (avatarUrl) {
      const img = document.createElement("img");
      img.className = "book-cover-avatar__img";
      img.src = avatarUrl;
      img.alt = label ? `รูปโปรไฟล์ ${label}` : "รูปโปรไฟล์";
      img.loading = "lazy";
      img.decoding = "async";
      wrap.append(img);
      return wrap;
    }

    const initial = document.createElement("span");
    initial.className = "book-cover-avatar__initial";
    initial.setAttribute("aria-hidden", "true");
    initial.textContent = label ? label.charAt(0).toUpperCase() : "?";
    wrap.append(initial);
    return wrap;
  }

  /**
   * @param {object} book
   * @param {{ compact?: boolean, portrait?: boolean, avatarUrl?: string, avatarName?: string }} [options]
   */
  function buildBookCoverElement(book, options = {}) {
    const shared = getShared();
    const toThaiNumber = shared?.toThaiNumber || ((value) => String(value ?? ""));
    const cover = document.createElement("div");
    const grade = document.createElement("div");
    const subject = document.createElement("div");
    const date = document.createElement("div");

    const classes = ["book-cover"];
    if (options.compact) classes.push("is-compact");
    if (options.portrait) classes.push("is-portrait");
    cover.className = classes.join(" ");
    if (options.avatarUrl || options.avatarName) {
      cover.classList.add("has-avatar");
      cover.append(
        buildAvatarElement(options.avatarUrl || "", options.avatarName || book?.studentName || "", options.compact)
      );
    }
    grade.className = "book-cover-grade";
    subject.className = "book-cover-subject";
    date.className = "book-cover-date";
    grade.textContent = `ประโยค ป.ธ. ${toThaiNumber(getCoverGrade(book))}`;
    subject.textContent = formatCoverSubjectLine(getSubjectLabel(book, shared));
    date.textContent = `สอบ วันที่ ${getCoverDateLabel(book, toThaiNumber)}`;
    cover.append(grade, subject, date);
    return cover;
  }

  global.PaligoExamBookCover = {
    THAI_MONTH_NAMES,
    buildBookCoverElement,
    getSubjectLabel,
    getCoverGrade,
    getCoverDateLabel,
    formatCoverSubjectLine,
  };
})(typeof window !== "undefined" ? window : globalThis);
