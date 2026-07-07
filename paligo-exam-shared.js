/**
 * Shared exam storage — student ↔ reviewer book transfer
 */
(function () {
  const KEYS = {
    books: "paligo-exam-answer-books-v1",
    submissions: "paligo-exam-submissions-v1",
    results: "paligo-exam-results-v1",
    receivedReviews: "paligo-exam-received-reviews-v1",
    activeBook: "paligo-exam-active-book-id-v1",
    owner: "paligo-exam-local-owner-id-v1",
    studentProfile: "paligo-exam-student-profile-v1",
    reviewerProfile: "paligo-exam-reviewer-profile-v1",
  };

  const BOOK_STATUS = {
    draft: "draft",
    underReview: "under_review",
    reviewed: "reviewed",
  };

  const STATUS_LABELS = {
    draft: "ฉบับร่าง",
    under_review: "อยู่ระหว่างตรวจ",
    reviewed: "ได้รับผลตรวจแล้ว",
    submitted: "อยู่ระหว่างตรวจ",
  };

  const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";

  function toThaiNumber(value) {
    return String(value ?? "").replace(/\d/g, (digit) => thaiDigits[Number(digit)] || digit);
  }

  function toThaiPercent(value) {
    const rounded = Math.round(Number(value) || 0);
    return `${toThaiNumber(rounded)}%`;
  }

  function getList(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function setList(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
  }

  function downloadJson(fileName, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function normalizeBookStatus(status) {
    if (status === "submitted") return BOOK_STATUS.underReview;
    if (status === BOOK_STATUS.reviewed) return BOOK_STATUS.reviewed;
    if (status === BOOK_STATUS.underReview) return BOOK_STATUS.underReview;
    return BOOK_STATUS.draft;
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[normalizeBookStatus(status)] || STATUS_LABELS.draft;
  }

  /**
   * Permission matrix — same book visible to both roles; edit rights differ by status.
   */
  function getBookPermissions(book, role) {
    const status = normalizeBookStatus(book?.status);
    const base = {
      canViewAnswer: true,
      canViewReview: true,
      canEditAnswer: false,
      canEditReview: false,
      canStamp: false,
      canSign: false,
      canSubmit: false,
      canStartNewRevision: false,
    };

    if (status === BOOK_STATUS.draft) {
      return {
        ...base,
        canEditAnswer: role === "student",
        canSubmit: role === "student",
      };
    }

    if (status === BOOK_STATUS.underReview) {
      return {
        ...base,
        canEditReview: role === "reviewer",
        canStamp: role === "reviewer",
        canSign: role === "reviewer",
      };
    }

    if (status === BOOK_STATUS.reviewed) {
      return {
        ...base,
        canStartNewRevision: role === "student",
      };
    }

    return base;
  }

  function pagesFromDraftOrSubmission(source) {
    if (!source) return [];
    if (Array.isArray(source.pages)) {
      if (typeof source.pages[0] === "string") return source.pages;
      return source.pages.map((page) => page.text || "");
    }
    if (source.draft?.pages) return source.draft.pages;
    return [];
  }

  async function computeAnswerHash(pages) {
    const text = pagesFromDraftOrSubmission({ pages }).join("\f");
    if (!window.crypto?.subtle) return null;
    const encoded = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function computeScore(scoreStamps) {
    const stamps = (scoreStamps || [])
      .map((stamp) => Number(stamp.value))
      .filter((value) => value >= 1 && value <= 3);
    const earned = stamps.reduce((sum, value) => sum + value, 0);
    const max = stamps.length * 3;
    const percent = max > 0 ? (earned / max) * 100 : 0;
    return { earned, max, percent, stampCount: stamps.length };
  }

  function getBookById(bookId) {
    return getList(KEYS.books).find((book) => book.id === bookId) || null;
  }

  function getLatestSubmissionForBook(bookId) {
    return getList(KEYS.submissions)
      .filter((item) => item.bookId === bookId)
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))[0] || null;
  }

  function getReviewForBook(bookId) {
    const book = getBookById(bookId);
    if (book?.review) return book.review;
    const reviews = getList(KEYS.receivedReviews)
      .filter((item) => item.bookId === bookId)
      .sort((a, b) => new Date(b.reviewedAt || 0) - new Date(a.reviewedAt || 0));
    return reviews[0] || null;
  }

  function getSavedReviewForSubmission(submissionId) {
    return getList(KEYS.results).find((item) => item.submissionId === submissionId) || null;
  }

  function saveReviewResult(result) {
    const results = getList(KEYS.results).filter((item) => item.submissionId !== result.submissionId);
    results.push(result);
    setList(KEYS.results, results);
    return result;
  }

  function upsertBookRecord(bookId, patch) {
    const books = getList(KEYS.books);
    const index = books.findIndex((book) => book.id === bookId);
    if (index < 0) return null;
    books[index] = { ...books[index], ...patch };
    setList(KEYS.books, books);
    return books[index];
  }

  function importReviewPayload(payload) {
    if (!payload || payload.schema !== "paligo.exam.review.v1") {
      throw new Error("ไฟล์นี้ไม่ใช่ผลตรวจ (paligo.exam.review.v1)");
    }
    if (!payload.bookId) {
      throw new Error("ผลตรวจไม่มี bookId — จับคู่สมุดไม่ได้");
    }

    const reviews = getList(KEYS.receivedReviews).filter(
      (item) => item.submissionId !== payload.submissionId
    );
    reviews.push(payload);
    setList(KEYS.receivedReviews, reviews);

    upsertBookRecord(payload.bookId, {
      review: payload,
      reviewReceivedAt: new Date().toISOString(),
      status: BOOK_STATUS.reviewed,
    });

    return payload;
  }

  function importBookTransfer(payload) {
    if (!payload || payload.schema !== "paligo.exam.bookTransfer.v1") {
      throw new Error("ไฟล์นี้ไม่ใช่แพ็กเกจโอนสมุด (paligo.exam.bookTransfer.v1)");
    }

    if (payload.book?.id) {
      const books = getList(KEYS.books).filter((book) => book.id !== payload.book.id);
      books.push(payload.book);
      setList(KEYS.books, books);
    }

    if (payload.submission) {
      const submissions = getList(KEYS.submissions).filter((item) => item.id !== payload.submission.id);
      submissions.push(payload.submission);
      setList(KEYS.submissions, submissions);
    }

    if (payload.review) {
      importReviewPayload(payload.review);
    }

    return payload;
  }

  function buildBookTransfer(bookId, direction) {
    const book = getBookById(bookId);
    if (!book) throw new Error("ไม่พบสมุดในเครื่อง");

    const submission = getLatestSubmissionForBook(bookId);
    const review = getReviewForBook(bookId) || getSavedReviewForSubmission(submission?.id);

    if (direction === "to-reviewer") {
      if (!submission) throw new Error("ยังไม่มี submission — ส่งตรวจก่อน");
      return {
        schema: "paligo.exam.bookTransfer.v1",
        direction: "to-reviewer",
        transferredAt: new Date().toISOString(),
        book: { ...book, status: BOOK_STATUS.underReview },
        submission,
        permissions: {
          answerLocked: true,
          reviewLocked: false,
          visibleTo: ["student", "reviewer"],
        },
      };
    }

    if (direction === "to-student") {
      if (!review) throw new Error("ยังไม่มีผลตรวจ — บันทึกการตรวจก่อน");
      return {
        schema: "paligo.exam.bookTransfer.v1",
        direction: "to-student",
        transferredAt: new Date().toISOString(),
        book: { ...book, status: BOOK_STATUS.reviewed, review },
        submission,
        review,
        permissions: {
          answerLocked: true,
          reviewLocked: true,
          visibleTo: ["student", "reviewer"],
        },
      };
    }

    throw new Error("ทิศทางโอนไม่รองรับ");
  }

  function formatThaiDateTime(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  window.PaligoExamShared = {
    KEYS,
    BOOK_STATUS,
    getList,
    setList,
    downloadJson,
    toThaiNumber,
    toThaiPercent,
    normalizeBookStatus,
    getStatusLabel,
    getBookPermissions,
    pagesFromDraftOrSubmission,
    computeAnswerHash,
    computeScore,
    getBookById,
    getLatestSubmissionForBook,
    getReviewForBook,
    getSavedReviewForSubmission,
    saveReviewResult,
    upsertBookRecord,
    importReviewPayload,
    importBookTransfer,
    buildBookTransfer,
    formatThaiDateTime,
  };
})();
