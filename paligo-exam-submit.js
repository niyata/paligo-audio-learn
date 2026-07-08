/**
 * Submit book to inbox — ส่งตรวจ = broadcast token ไป inbox ครู (ไม่ใช่ export)
 */
(function (global) {
  async function submitBookToInbox(bookId, options = {}) {
    const shared = global.PaligoExamShared;
    const client = global.PaligoInboxClient;
    if (!shared) throw new Error("โหลด PaligoExamShared ไม่ครบ");

    const book = shared.getBookById(bookId);
    if (!book) {
      return { ok: false, reason: "not_found", message: "ไม่พบสมุดข้อสอบ" };
    }

    const status = shared.normalizeBookStatus(book.status);
    if (status === shared.BOOK_STATUS.reviewed) {
      return {
        ok: false,
        reason: "reviewed",
        message: "สมุดนี้ได้รับผลตรวจแล้ว — กดทำรอบใหม่หากต้องการส่ง revision ถัดไป",
      };
    }

    if (!client?.isLoggedIn?.() || client.getInboxRole?.() !== "student") {
      return {
        ok: false,
        reason: "not_logged_in",
        message: "เข้าสู่ระบบ (นักเรียน) ก่อนส่งตรวจ",
        bookId,
      };
    }

    if (status === shared.BOOK_STATUS.underReview) {
      return pushExistingBookToInbox(bookId, options);
    }

    let result = await shared.submitBookForReview(bookId, options);
    if (!result.ok) return result;

    try {
      await client.ensureAuthenticatedSession?.();
      const transfer = shared.buildBookTransfer(bookId, "to-reviewer");
      const push = await client.pushPackage(transfer);
      return {
        ok: true,
        mode: "submit_and_push",
        submission: result.submission,
        push,
        book: shared.getBookById(bookId),
        message: `ส่งตรวจแล้ว — ส่งให้ ${push.intendedRecipientLabel || "ครู"} เรียบร้อย`,
      };
    } catch (error) {
      return {
        ok: true,
        partial: true,
        mode: "submit_only",
        submission: result.submission,
        book: shared.getBookById(bookId),
        message: `ส่งตรวจแล้ว แต่ส่งไม่สำเร็จ — ${error.message || "ลองจากกล่องข้อความ"}`,
        error,
      };
    }
  }

  async function pushExistingBookToInbox(bookId, options = {}) {
    const shared = global.PaligoExamShared;
    const client = global.PaligoInboxClient;

    if (options.repush !== true) {
      return {
        ok: false,
        reason: "under_review",
        message: "สมุดเล่มนี้อยู่ระหว่างส่งตรวจแล้ว — รอผู้ตรวจตรวจหรือยกเลิกส่งตรวจ (ภายใน ๔๘ ชั่วโมง)",
        bookId,
      };
    }

    try {
      await client.ensureAuthenticatedSession?.();
      const submission =
        shared.getLatestSubmissionForBook(bookId) || (await shared.ensureSubmissionForBook(bookId));
      if (!submission) {
        return {
          ok: false,
          reason: "no_submission",
          message: "ยังไม่มีข้อมูลการส่งตรวจ — เปิดสมุดแล้วลองใหม่",
          bookId,
        };
      }
      const transfer = shared.buildBookTransfer(bookId, "to-reviewer");
      const push = await client.pushPackage(transfer);
      return {
        ok: true,
        mode: "push_only",
        push,
        message: `ส่งให้ ${push.intendedRecipientLabel || "ครู"} อีกครั้งแล้ว`,
      };
    } catch (error) {
      return {
        ok: false,
        reason: "push_failed",
        message: error.message || "ส่งไม่สำเร็จ",
        bookId,
      };
    }
  }

  global.PaligoExamSubmit = {
    submitBookToInbox,
    pushExistingBookToInbox,
    async pushReviewToStudent(bookId) {
      const shared = global.PaligoExamShared;
      const client = global.PaligoInboxClient;
      if (!shared) throw new Error("โหลด PaligoExamShared ไม่ครบ");
      if (!client?.isLoggedIn?.() || client.getInboxRole?.() !== "reviewer") {
        return {
          ok: false,
          reason: "not_reviewer",
          message: "เข้าสู่ระบบ (ผู้ตรวจ) ก่อนส่งผลกลับ",
          bookId,
        };
      }
      try {
        await client.ensureAuthenticatedSession?.();
        const transfer = shared.buildBookTransfer(bookId, "to-student");
        const push = await client.pushPackage(transfer);
        return {
          ok: true,
          push,
          message: `ส่งผลตรวจให้ ${push.intendedRecipientLabel || "นักเรียน"} แล้ว`,
        };
      } catch (error) {
        return {
          ok: false,
          reason: "push_failed",
          message: error.message || "ส่งไม่สำเร็จ",
          bookId,
          error,
        };
      }
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
