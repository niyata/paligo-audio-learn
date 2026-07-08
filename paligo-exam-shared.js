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
    reviewerSignature: "paligo-exam-reviewer-signature-v1",
  };

  const BOOK_STATUS = {
    draft: "draft",
    underReview: "under_review",
    reviewed: "reviewed",
  };

  const CANCEL_SUBMIT_WINDOW_MS = 48 * 60 * 60 * 1000;

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

  function toArabicDigits(value) {
    return String(value ?? "").replace(/[๐-๙]/g, (digit) => {
      const index = thaiDigits.indexOf(digit);
      return index >= 0 ? String(index) : digit;
    });
  }

  function toThaiPercent(value) {
    const rounded = Math.round(Number(value) || 0);
    return `${toThaiNumber(rounded)}%`;
  }

  const INBOX_SESSION_KEY = "paligo-inbox-session-v1";
  const LEGACY_SCOPE = "legacy";

  function getInboxSession() {
    if (typeof window !== "undefined" && window.PaligoInboxClient?.getSession) {
      return window.PaligoInboxClient.getSession();
    }
    try {
      const parsed = JSON.parse(localStorage.getItem(INBOX_SESSION_KEY) || "null");
      if (!parsed?.sessionToken) return null;
      if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function getInboxRole() {
    return getInboxSession()?.user?.role || null;
  }

  function getInboxUserId() {
    return getInboxSession()?.user?.id || null;
  }

  function resolveStorageScope() {
    return getInboxUserId() || LEGACY_SCOPE;
  }

  function scopedStorageKey(key) {
    return `${key}::${resolveStorageScope()}`;
  }

  /** ย้ายข้อมูลเก่า (ก่อนมีบัญชี) เข้า scope นักเรียนเท่านั้น */
  function maybeMigrateLegacyKey(key) {
    const scope = resolveStorageScope();
    if (scope === LEGACY_SCOPE) return;
    const target = scopedStorageKey(key);
    if (localStorage.getItem(target) != null) return;
    const legacy = localStorage.getItem(key);
    if (!legacy) return;
    if (getInboxRole() === "student") {
      localStorage.setItem(target, legacy);
    }
  }

  function readRaw(key) {
    maybeMigrateLegacyKey(key);
    const scoped = scopedStorageKey(key);
    let value = localStorage.getItem(scoped);
    if (value == null && resolveStorageScope() === LEGACY_SCOPE) {
      value = localStorage.getItem(key);
    }
    return value;
  }

  function writeRaw(key, value) {
    localStorage.setItem(scopedStorageKey(key), value);
  }

  /**
   * แยกหน้าตามบทบาท Inbox — draft นักเรียนไม่ให้ครูเห็นบนเครื่องเดียวกัน
   * @param {{ page: 'student'|'reviewer', reviewMode?: boolean }} options
   */
  function guardExamPageRole(options = {}) {
    const role = getInboxRole();
    if (!role) {
      return { ok: true, role: null, legacy: true };
    }

    if (options.page === "student" && role === "reviewer" && !options.reviewMode) {
      return {
        ok: false,
        redirect: "exam-reviewer-console.html",
        message: "บัญชีครู/ผู้ตรวจ — ดูเฉพาะงานที่ส่งเข้ามา ไม่เห็นฉบับร่างของนักเรียน",
      };
    }

    if (options.page === "reviewer" && role === "student") {
      return {
        ok: false,
        redirect: "exam-books.html",
        message: "บัญชีนักเรียน — ใช้หน้าสมุดข้อสอบของฉัน",
      };
    }

    return { ok: true, role, legacy: false };
  }

  function getList(key) {
    try {
      const parsed = JSON.parse(readRaw(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function setList(key, list) {
    writeRaw(key, JSON.stringify(list));
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
      canCancelSubmit: false,
    };

    if (status === BOOK_STATUS.draft) {
      return {
        ...base,
        canEditAnswer: role === "student",
        canSubmit: role === "student",
      };
    }

    if (status === BOOK_STATUS.underReview) {
      const cancelState = role === "student" ? getCancelSubmitState(book, role) : { canCancel: false };
      return {
        ...base,
        canEditReview: role === "reviewer",
        canStamp: role === "reviewer",
        canSign: role === "reviewer",
        canCancelSubmit: cancelState.canCancel,
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
      .filter((item) => item.bookId === bookId && !item.cancelledAt)
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))[0] || null;
  }

  function getStudentProfile() {
    try {
      return JSON.parse(readRaw(KEYS.studentProfile) || "null");
    } catch {
      return null;
    }
  }

  function getReviewerProfile() {
    try {
      return JSON.parse(readRaw(KEYS.reviewerProfile) || "null");
    } catch {
      return null;
    }
  }

  function saveReviewerProfile(profile) {
    const payload = {
      name: String(profile?.name || "").trim(),
      role: profile?.role || "teacher-reviewer",
      updatedAt: new Date().toISOString(),
    };
    writeRaw(KEYS.reviewerProfile, JSON.stringify(payload));
    return payload;
  }

  /** โปรไฟล์ผู้ตรวจบนหน้า console — รวมชื่อจาก Inbox session */
  function resolveReviewerProfileForConsole() {
    const local = getReviewerProfile();
    const inboxUser =
      typeof window !== "undefined" ? window.PaligoInboxClient?.getSession?.()?.user : null;

    if (inboxUser?.role === "reviewer") {
      return {
        name: local?.name?.trim() || inboxUser.displayName?.trim() || "",
        role: local?.role || "teacher-reviewer",
        inboxUserId: inboxUser.id,
        displayName: inboxUser.displayName || "",
        fromInbox: true,
      };
    }

    if (local) {
      return {
        name: local.name || "",
        role: local.role || "teacher-reviewer",
        fromInbox: false,
      };
    }

    return { name: "", role: "teacher-reviewer", fromInbox: false };
  }

  /** รวม submission จากสมุดที่อยู่ระหว่างตรวจเข้าคิวในเครื่อง */
  function syncReviewQueueFromBooks() {
    const books = getList(KEYS.books).filter(
      (book) => normalizeBookStatus(book.status) === BOOK_STATUS.underReview
    );
    if (!books.length) return getList(KEYS.submissions);

    let submissions = getList(KEYS.submissions);
    let changed = false;

    books.forEach((book) => {
      const latest = getLatestSubmissionForBook(book.id);
      if (!latest) return;
      if (submissions.some((item) => item.id === latest.id)) return;
      submissions.push(latest);
      changed = true;
    });

    if (changed) setList(KEYS.submissions, submissions);
    return submissions;
  }

  function listActiveSubmissions() {
    syncReviewQueueFromBooks();
    return getList(KEYS.submissions)
      .filter((item) => !item.cancelledAt)
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  }

  function getReviewerSignature() {
    try {
      return JSON.parse(readRaw(KEYS.reviewerSignature) || "null");
    } catch {
      return null;
    }
  }

  function saveReviewerSignature(signature) {
    if (!signature?.dataUrl) {
      writeRaw(KEYS.reviewerSignature, "");
      return null;
    }
    const payload = {
      dataUrl: signature.dataUrl,
      widthPx: signature.widthPx || 120,
      label: signature.label || "ลายเซ็นผู้ตรวจ",
      updatedAt: new Date().toISOString(),
    };
    writeRaw(KEYS.reviewerSignature, JSON.stringify(payload));
    return payload;
  }

  function resolveStudentProfileForSubmit() {
    const local = getStudentProfile();
    if (local?.studentName?.trim()) return local;

    const inboxUser =
      typeof window !== "undefined" ? window.PaligoInboxClient?.getSession?.()?.user : null;
    if (inboxUser?.role === "student" && inboxUser.displayName?.trim()) {
      return {
        studentName: inboxUser.displayName.trim(),
        grade: local?.grade || "4",
        teacherRole: local?.teacherRole || "teacher-reviewer",
        teacherName: local?.teacherName || "",
        deliveryMethod: local?.deliveryMethod || "line",
        inboxUserId: inboxUser.id,
      };
    }
    return null;
  }

  function createSubmissionId() {
    const random =
      typeof crypto !== "undefined" && crypto.randomUUID?.()
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `submission-${random}`;
  }

  async function submitBookForReview(bookId, options = {}) {
    const book = getBookById(bookId);
    if (!book) throw new Error("ไม่พบสมุดข้อสอบ");

    const status = normalizeBookStatus(book.status);
    if (status === BOOK_STATUS.underReview && !options.forceUnderReview) {
      return {
        ok: false,
        reason: "under_review",
        message: "สมุดเล่มนี้อยู่ระหว่างส่งตรวจแล้ว — รอผู้ตรวจตรวจหรือยกเลิกส่งตรวจ (ภายใน ๔๘ ชั่วโมง)",
      };
    }
    if (status === BOOK_STATUS.reviewed) {
      return {
        ok: false,
        reason: "reviewed",
        message: "สมุดนี้ได้รับผลตรวจแล้ว — เปิดสมุดแล้วกด「ทำรอบใหม่」หากต้องการส่ง revision ถัดไป",
      };
    }

    const profile = resolveStudentProfileForSubmit();
    if (!profile?.studentName?.trim()) {
      return {
        ok: false,
        reason: "no_profile",
        message: "เข้าสู่ระบบ Inbox (นักเรียน) หรือตั้งชื่อในโปรไฟล์ก่อนส่งตรวจ",
        bookId,
      };
    }

    const draft = book.draft || {};
    const pages = pagesFromDraftOrSubmission(draft);
    const hasAnswer = pages.some((text) => String(text || "").trim().length > 0);
    if (!hasAnswer) {
      return {
        ok: false,
        reason: "empty",
        message: "ยังไม่มีคำตอบในสมุด — เปิดสมุดแล้วเขียนก่อนส่งตรวจ",
        bookId,
      };
    }

    const priorSubmissions = getList(KEYS.submissions).filter(
      (item) => item.bookId === bookId && !item.cancelledAt
    );
    if (priorSubmissions.length && !options.skipResubmitConfirm) {
      return {
        ok: false,
        reason: "resubmit_confirm",
        message: `สมุดนี้เคยส่งตรวจแล้ว ${toThaiNumber(priorSubmissions.length)} ครั้ง — ส่งอีกครั้งจะสร้าง submission ใหม่`,
        existingCount: priorSubmissions.length,
        bookId,
      };
    }

    const submittedAt = new Date().toISOString();
    const pageObjects = pages.map((text, index) => ({ index, text }));
    const answerHash = await computeAnswerHash(pageObjects);
    const ownerId = readRaw(KEYS.owner) || book.ownerId || "";
    const gradePicker = draft.pickers?.find((picker) => picker.type === "grade");

    const submission = {
      schema: "paligo.exam.submission.v1",
      id: createSubmissionId(),
      ownerId,
      bookId,
      bookRevision: book.revision || 1,
      bookTitle: book.title,
      submittedAt,
      answerHash,
      studentName: profile.studentName.trim(),
      studentRole: "student",
      teacherRole: profile.teacherRole || "teacher-reviewer",
      teacherName: profile.teacherName || "",
      deliveryMethod: profile.deliveryMethod || "line",
      profile: { ...profile },
      grade: book.grade || gradePicker?.value || profile.grade || "4",
      pickers: draft.pickers || [],
      pages: pageObjects,
      annotations: Array.isArray(draft.annotations) ? draft.annotations.slice() : [],
    };

    const submissions = getList(KEYS.submissions);
    submissions.push(submission);
    setList(KEYS.submissions, submissions);

    upsertBookRecord(bookId, {
      status: BOOK_STATUS.underReview,
      submittedAt,
      updatedAt: submittedAt,
      studentName: profile.studentName.trim(),
    });

    return { ok: true, submission, book: getBookById(bookId) };
  }

  async function ensureSubmissionForBook(bookId) {
    const existing = getLatestSubmissionForBook(bookId);
    if (existing) return existing;

    const book = getBookById(bookId);
    if (!book || normalizeBookStatus(book.status) !== BOOK_STATUS.underReview) return null;

    const result = await submitBookForReview(bookId, {
      skipResubmitConfirm: true,
      forceUnderReview: true,
    });
    return result.ok ? result.submission : null;
  }

  function getBookSubmittedAt(book) {
    if (!book) return null;
    if (book.submittedAt) return book.submittedAt;
    const submission = getLatestSubmissionForBook(book.id);
    return submission?.submittedAt || null;
  }

  function getCancelSubmitState(book, role = "student") {
    const status = normalizeBookStatus(book?.status);
    if (role !== "student" || status !== BOOK_STATUS.underReview) {
      return { showButton: false, canCancel: false, disabled: true, tooltip: "" };
    }

    const submittedAt = getBookSubmittedAt(book);
    if (!submittedAt) {
      return {
        showButton: true,
        canCancel: true,
        disabled: false,
        tooltip: "ยกเลิกส่งตรวจ — กลับไปแก้ไขฉบับร่างได้",
      };
    }

    const elapsed = Date.now() - new Date(submittedAt).getTime();
    if (elapsed >= CANCEL_SUBMIT_WINDOW_MS) {
      return {
        showButton: true,
        canCancel: false,
        disabled: true,
        tooltip: "ยกเลิกส่งตรวจไม่ได้ — ส่งตรวจครบ ๔๘ ชั่วโมงแล้ว",
      };
    }

    const remainingMs = CANCEL_SUBMIT_WINDOW_MS - elapsed;
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return {
      showButton: true,
      canCancel: true,
      disabled: false,
      tooltip: `ยกเลิกส่งตรวจ — เหลือเวลาอีกประมาณ ${toThaiNumber(remainingHours)} ชั่วโมง`,
    };
  }

  function cancelBookSubmit(bookId) {
    const book = getBookById(bookId);
    if (!book) throw new Error("ไม่พบสมุดข้อสอบ");

    const state = getCancelSubmitState(book, "student");
    if (!state.canCancel) {
      throw new Error(state.tooltip || "ยกเลิกส่งตรวจไม่ได้");
    }

    const now = new Date().toISOString();
    const submissions = getList(KEYS.submissions);
    const latest = submissions
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.bookId === bookId && !item.cancelledAt)
      .sort((a, b) => new Date(b.item.submittedAt || 0) - new Date(a.item.submittedAt || 0))[0];

    if (latest) {
      submissions[latest.index] = { ...submissions[latest.index], cancelledAt: now };
      setList(KEYS.submissions, submissions);
    }

    return upsertBookRecord(bookId, {
      status: BOOK_STATUS.draft,
      submittedAt: null,
      cancelSubmitAt: now,
    });
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
      const books = upsertBookInList(
        getList(KEYS.books).filter((book) => book.id !== payload.book.id),
        payload.book
      );
      setList(KEYS.books, sortBooksNewestFirst(books));
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

  /** Book/cover-facing dates — Thai digits (exam paper & cover only). */
  function formatBookDateTime(value) {
    return toThaiNumber(formatThaiDateTime(value));
  }

  const SUBJECT_OPTIONS = [
    { value: "pali-to-thai", label: "แปลมคธเป็นไทย" },
    { value: "grammar", label: "ไวยากรณ์" },
    { value: "thai-to-pali", label: "แปลไทยเป็นมคธ" },
    { value: "sambandha-thai", label: "สัมพันธ์ไทย" },
    { value: "burapapak", label: "บุรพภาค" },
    { value: "chanda-magadhi", label: "แต่งฉันท์มคธ" },
    { value: "compose-thai-to-magadhi", label: "แต่งไทยเป็นมคธ" },
  ];

  /** หลักสูตรแม่กองบาลีสนามหลวง — วิชาที่เลือกได้ต่อชั้น ป.ธ. */
  const SUBJECTS_BY_GRADE = {
    "1-2": ["grammar", "pali-to-thai"],
    "3": ["grammar", "pali-to-thai", "sambandha-thai", "burapapak"],
    "4": ["thai-to-pali", "pali-to-thai"],
    "5": ["thai-to-pali", "pali-to-thai"],
    "6": ["thai-to-pali", "pali-to-thai"],
    "7": ["thai-to-pali", "pali-to-thai"],
    "8": ["chanda-magadhi", "thai-to-pali", "pali-to-thai"],
    "9": ["compose-thai-to-magadhi", "thai-to-pali", "pali-to-thai"],
  };

  const SUBJECT_LABELS = Object.fromEntries(SUBJECT_OPTIONS.map((item) => [item.value, item.label]));

  function getSubjectOption(value) {
    return (
      SUBJECT_OPTIONS.find((item) => item.value === String(value)) ||
      SUBJECT_OPTIONS.find((item) => item.value === "pali-to-thai")
    );
  }

  function getSubjectLabelByValue(value) {
    return getSubjectOption(value)?.label || "แปลมคธเป็นไทย";
  }

  function getSubjectOptionsForGrade(grade) {
    const allowedValues = SUBJECTS_BY_GRADE[String(grade)] || ["pali-to-thai"];
    return allowedValues
      .map((value) => SUBJECT_OPTIONS.find((item) => item.value === value))
      .filter(Boolean);
  }

  function getGradesForSubject(subjectValue) {
    const grades = Object.entries(SUBJECTS_BY_GRADE)
      .filter(([, subjects]) => subjects.includes(String(subjectValue)))
      .map(([grade]) => grade);
    return grades.length ? grades : Object.keys(SUBJECTS_BY_GRADE);
  }

  function normalizePickerValue(type, value) {
    if (value == null || value === "") return value;
    if (type === "grade") return toArabicDigits(String(value)).trim();
    if (type === "day" || type === "month" || type === "year") return toArabicDigits(String(value)).trim();
    return String(value);
  }

  function inferSubjectFromTitle(title) {
    const parts = String(title || "")
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      const maybeSubject = parts[parts.length - 2];
      const entry = Object.entries(SUBJECT_LABELS).find(([, label]) => label === maybeSubject);
      if (entry) return { subject: entry[0], subjectLabel: entry[1] };
    }
    for (const part of parts) {
      const entry = Object.entries(SUBJECT_LABELS).find(([, label]) => label === part);
      if (entry) return { subject: entry[0], subjectLabel: entry[1] };
    }
    return null;
  }

  function inferGradeFromTitle(title) {
    const match = String(title || "").match(/ป\.?\s*ธ\.?\s*([๐-๙0-9\-]+)/);
    return match ? normalizePickerValue("grade", match[1]) : "";
  }

  /** Keep legacy/local books readable after display and schema tweaks. */
  function normalizeExamBookRecord(book) {
    if (!book || typeof book !== "object") return book;

    const next = { ...book };
    let changed = false;
    const mark = (patch) => {
      Object.assign(next, patch);
      changed = true;
    };

    const gradeFromTitle = inferGradeFromTitle(next.title);
    const normalizedGrade = normalizePickerValue("grade", next.grade || gradeFromTitle || "");
    if (normalizedGrade && normalizedGrade !== next.grade) {
      mark({ grade: normalizedGrade });
    }

    const inferredSubject = inferSubjectFromTitle(next.title);
    if (!next.subject && inferredSubject) {
      mark({ subject: inferredSubject.subject, subjectLabel: inferredSubject.subjectLabel });
    } else if (next.subject && !next.subjectLabel && SUBJECT_LABELS[next.subject]) {
      mark({ subjectLabel: SUBJECT_LABELS[next.subject] });
    }

    if (next.draft && typeof next.draft === "object") {
      const draft = { ...next.draft };
      if (Array.isArray(draft.pickers)) {
        const pickers = draft.pickers.map((picker) => {
          if (!picker || typeof picker !== "object") return picker;
          const value = normalizePickerValue(picker.type, picker.value);
          if (value === picker.value) return picker;
          changed = true;
          return { ...picker, value };
        });
        draft.pickers = pickers;
      }
      if (draft !== next.draft) next.draft = draft;
    }

    return changed ? next : book;
  }

  function getBookCreatedAtMs(book) {
    const value = book?.createdAt || book?.draft?.savedAt || book?.updatedAt || 0;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }

  function compareBooksByNewest(a, b) {
    const diff = getBookCreatedAtMs(b) - getBookCreatedAtMs(a);
    if (diff !== 0) return diff;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  }

  function sortBooksNewestFirst(books) {
    if (!Array.isArray(books)) return [];
    return [...books].sort(compareBooksByNewest);
  }

  function upsertBookInList(books, book) {
    const list = Array.isArray(books) ? [...books] : [];
    const index = list.findIndex((item) => item.id === book.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...book };
      return list;
    }
    list.unshift(book);
    return list;
  }

  function migrateExamBooksList() {
    const books = getList(KEYS.books);
    if (!books.length) return books;

    let changed = false;
    const migrated = books.map((book) => {
      const next = normalizeExamBookRecord(book);
      if (next !== book) changed = true;
      return next;
    });

    const sorted = sortBooksNewestFirst(migrated);
    const orderChanged = sorted.some((book, index) => book.id !== migrated[index]?.id);
    if (changed || orderChanged) setList(KEYS.books, sorted);
    return sorted;
  }

  window.PaligoExamShared = {
    KEYS,
    INBOX_SESSION_KEY,
    BOOK_STATUS,
    CANCEL_SUBMIT_WINDOW_MS,
    getInboxSession,
    getInboxRole,
    getInboxUserId,
    resolveStorageScope,
    scopedStorageKey,
    readRaw,
    writeRaw,
    guardExamPageRole,
    getList,
    setList,
    downloadJson,
    toThaiNumber,
    toArabicDigits,
    toThaiPercent,
    normalizeBookStatus,
    getStatusLabel,
    getBookPermissions,
    getBookSubmittedAt,
    getCancelSubmitState,
    cancelBookSubmit,
    getStudentProfile,
    getReviewerProfile,
    saveReviewerProfile,
    resolveReviewerProfileForConsole,
    syncReviewQueueFromBooks,
    listActiveSubmissions,
    getReviewerSignature,
    saveReviewerSignature,
    resolveStudentProfileForSubmit,
    submitBookForReview,
    ensureSubmissionForBook,
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
    formatBookDateTime,
    normalizeExamBookRecord,
    getBookCreatedAtMs,
    compareBooksByNewest,
    sortBooksNewestFirst,
    upsertBookInList,
    migrateExamBooksList,
    SUBJECT_OPTIONS,
    SUBJECTS_BY_GRADE,
    SUBJECT_LABELS,
    getSubjectOption,
    getSubjectLabelByValue,
    getSubjectOptionsForGrade,
    getGradesForSubject,
  };
})();
