/**
 * Inbox chat — local thread + flex-style book card messages
 */
(function (global) {
  const STORAGE_KEY = "paligo-inbox-chat-v1";
  const CLAIMED_ITEMS_KEY = "paligo-inbox-claimed-items-v1";

  function createId(prefix) {
    const random = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${random}`;
  }

  function readRaw(key) {
    try {
      return global.localStorage?.getItem(key);
    } catch {
      return null;
    }
  }

  function writeRaw(key, value) {
    global.localStorage?.setItem(key, value);
  }

  function storageKeyForThread(threadId) {
    const userId = global.PaligoInboxClient?.getSession?.()?.user?.id || "anonymous";
    return `${STORAGE_KEY}::${userId}::${threadId}`;
  }

  function getMessages(threadId) {
    try {
      const parsed = JSON.parse(readRaw(storageKeyForThread(threadId)) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveMessages(threadId, messages) {
    writeRaw(storageKeyForThread(threadId), JSON.stringify(messages));
    return messages;
  }

  function readClaimedItems() {
    try {
      const parsed = JSON.parse(readRaw(CLAIMED_ITEMS_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function markInboxItemClaimed(inboxItemId, patch = {}) {
    if (!inboxItemId) return null;
    const items = readClaimedItems();
    const claimedAt = patch.claimedAt || new Date().toISOString();
    const record = {
      ...(items[inboxItemId] || {}),
      ...patch,
      inboxItemId,
      status: "claimed",
      claimedAt,
      updatedAt: new Date().toISOString(),
    };
    items[inboxItemId] = record;
    writeRaw(CLAIMED_ITEMS_KEY, JSON.stringify(items));
    return record;
  }

  function getInboxItemClaim(inboxItemId) {
    if (!inboxItemId) return null;
    return readClaimedItems()[inboxItemId] || null;
  }

  function appendMessage(threadId, message) {
    const messages = getMessages(threadId);
    messages.push(message);
    saveMessages(threadId, messages);
    return message;
  }

  function upsertMessage(threadId, message) {
    const messages = getMessages(threadId);
    const index = messages.findIndex((item) => item.id === message.id);
    if (index >= 0) messages[index] = { ...messages[index], ...message };
    else messages.push(message);
    saveMessages(threadId, messages);
    return message;
  }

  function removeMessage(threadId, messageId) {
    const messages = getMessages(threadId).filter((item) => item.id !== messageId);
    saveMessages(threadId, messages);
    return messages;
  }

  function formatTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function appendSystemMessage(threadId, text) {
    return appendMessage(threadId, {
      id: createId("msg"),
      type: "system",
      text,
      at: new Date().toISOString(),
    });
  }

  function bookSnapshot(book) {
    if (!book) return null;
    return {
      id: book.id,
      title: book.title,
      grade: book.grade,
      subject: book.subject,
      subjectLabel: book.subjectLabel,
      status: book.status,
      revision: book.revision || 1,
      studentName: book.studentName,
      avatarUrl: book.avatarUrl || book.profile?.avatarUrl || book.studentProfile?.avatarUrl || "",
      profile: book.profile ? { avatarUrl: book.profile.avatarUrl || "" } : null,
      studentProfile: book.studentProfile ? { avatarUrl: book.studentProfile.avatarUrl || "" } : null,
      updatedAt: book.updatedAt,
      draft: book.draft
        ? {
            pickers: book.draft.pickers,
          }
        : null,
    };
  }

  function resolveSenderAvatarUrl() {
    const profileApi = global.PaligoProfile;
    if (!profileApi?.resolveSessionAvatar) return "";
    try {
      return profileApi.resolveSessionAvatar() || "";
    } catch {
      return "";
    }
  }

  function resolveThreadId({ role, userId, reviewerUserId }) {
    if (role === "reviewer") return `reviewer-inbox-${userId}`;
    return `student-${userId}-${reviewerUserId || "peer"}`;
  }

  function normalizeThreadPart(value) {
    return String(value || "peer").replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function resolvePeerThreadId({ role, userId, peerUserId, reviewerUserId }) {
    if (role === "reviewer") {
      return `reviewer-${normalizeThreadPart(userId)}-student-${normalizeThreadPart(peerUserId)}`;
    }
    return resolveThreadId({ role, userId, reviewerUserId: reviewerUserId || peerUserId });
  }

  async function resolveThreadIdForSession() {
    const client = global.PaligoInboxClient;
    const session = client?.getSession?.();
    if (!session?.user) return null;

    let pairing = null;
    try {
      pairing = await client.getMe?.();
    } catch {
      /* optional */
    }

    return resolveThreadId({
      role: session.user.role,
      userId: session.user.id,
      reviewerUserId: pairing?.pairing?.reviewerUserId,
    });
  }

  function upsertBookMessage(threadId, payload) {
    const existing = getMessages(threadId).find(
      (item) => item.bookId === payload.bookId && item.type === "book"
    );
    if (existing) {
      upsertMessage(threadId, { ...existing, ...payload, id: existing.id });
      return existing.id;
    }
    const id = createId("msg");
    appendMessage(threadId, { id, type: "book", direction: "out", ...payload });
    return id;
  }

  /**
   * บันทึกสมุดที่ส่งตรวจลงแชต inbox (local thread) — ใช้หลัง submit สำเร็จ
   */
  async function recordBookSubmission({ book, result, submission } = {}) {
    const client = global.PaligoInboxClient;
    const session = client?.getSession?.();
    if (!session?.user || session.user.role !== "student" || !book?.id) return null;

    const threadId = await resolveThreadIdForSession();
    if (!threadId) return null;

    const shared = global.PaligoExamShared;
    const fresh = shared?.getBookById?.(book.id) || book;
    const underReview = shared?.BOOK_STATUS?.underReview || "under_review";
    const messageId = upsertBookMessage(threadId, {
      bookId: book.id,
      book: bookSnapshot(fresh),
      bookStatus: underReview,
      subtitle: `revision ${fresh?.revision || submission?.bookRevision || 1} · ${result?.push?.intendedRecipientLabel || "ครู"}`,
      senderAvatarUrl: resolveSenderAvatarUrl(),
      inboxPushed: Boolean(
        result?.push || result?.mode === "submit_and_push" || result?.mode === "push_only"
      ),
      inboxItemId: result?.push?.inboxItemId,
      inboxStatus: "pending",
      submissionId: submission?.id || result?.submission?.id,
      at: submission?.submittedAt || new Date().toISOString(),
    });

    appendSystemMessage(threadId, result?.message || "ส่งสมุดเข้า inbox แล้ว");
    const message = getMessages(threadId).find((item) => item.id === messageId) || null;
    return { threadId, messageId, message };
  }

  function renderTextBubble(message) {
    const row = document.createElement("div");
    const bubble = document.createElement("div");
    const time = document.createElement("time");

    row.className = `inbox-chat__row is-${message.direction || "out"}`;
    bubble.className = "inbox-chat__bubble";
    bubble.textContent = message.text || "";
    time.className = "inbox-chat__time";
    time.dateTime = message.at || "";
    time.textContent = formatTime(message.at);
    row.append(bubble, time);
    return row;
  }

  function renderSystemMessage(message) {
    const row = document.createElement("div");
    row.className = "inbox-chat__row is-system";
    const pill = document.createElement("div");
    pill.className = "inbox-chat__system";
    pill.textContent = message.text || "";
    row.append(pill);
    return row;
  }

  /**
   * LINE Flex–style book card message
   * @param {object} options
   */
  function renderBookFlexCard(options) {
    const {
      message,
      book,
      statusLabel = "",
      subtitle = "",
      actions = [],
      senderName = "",
      senderAvatarUrl = "",
    } = options;

    const shared = global.PaligoExamShared;
    const coverApi = global.PaligoExamBookCover;
    const row = document.createElement("div");
    const card = document.createElement("article");
    const header = document.createElement("div");
    const body = document.createElement("div");
    const footer = document.createElement("div");
    const time = document.createElement("time");

    row.className = `inbox-chat__row is-${message.direction || "out"} is-card`;
    card.className = "inbox-flex-card";
    card.dataset.messageId = message.id || "";
    card.dataset.bookId = message.bookId || book?.id || "";
    if (message.direction === "out") {
      card.title = "คลิกขวาเพื่อยกเลิกการส่ง (ถ้ายังอยู่ในช่วงเวลา)";
    }

    if (senderName && message.direction === "in") {
      const sender = document.createElement("div");
      sender.className = "inbox-flex-card__sender";
      sender.textContent = senderName;
      card.append(sender);
    }

    header.className = "inbox-flex-card__hero";
    if (book && coverApi?.buildBookCoverElement) {
      const avatarName = senderName || book?.studentName || "";
      const avatarUrl = senderAvatarUrl || message.senderAvatarUrl || "";
      header.append(
        coverApi.buildBookCoverElement(book, {
          compact: true,
          avatarUrl,
          avatarName,
        })
      );
    }

    body.className = "inbox-flex-card__body";
    const title = document.createElement("div");
    title.className = "inbox-flex-card__title";
    title.textContent = book?.title || book?.bookTitle || "สมุดข้อสอบ";
    body.append(title);

    if (subtitle) {
      const meta = document.createElement("div");
      meta.className = "inbox-flex-card__meta";
      meta.textContent = subtitle;
      body.append(meta);
    }

    if (statusLabel) {
      const chip = document.createElement("span");
      chip.className = "inbox-flex-card__status";
      chip.textContent = statusLabel;
      body.append(chip);
    }

    footer.className = "inbox-flex-card__actions";
    actions.forEach((action) => {
      if (action.hidden) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `inbox-flex-card__btn${action.primary ? " is-primary" : ""}`;
      btn.textContent = action.label;
      btn.disabled = Boolean(action.disabled);
      if (action.title) btn.title = action.title;
      btn.addEventListener("click", action.onClick);
      footer.append(btn);
    });

    card.append(header, body);
    if (footer.childElementCount) card.append(footer);

    time.className = "inbox-chat__time";
    time.dateTime = message.at || "";
    time.textContent = formatTime(message.at);

    row.append(card, time);
    return row;
  }

  function renderMessage(message, handlers = {}) {
    if (message.type === "system") return renderSystemMessage(message);
    if (message.type === "text") return renderTextBubble(message);
    if (message.type === "book") {
      return handlers.renderBookCard?.(message) || renderBookFlexCard({
        message,
        book: message.book,
        statusLabel: message.statusLabel || "",
        subtitle: message.subtitle || "",
        actions: [],
        senderName: message.senderName || "",
        senderAvatarUrl: message.senderAvatarUrl || "",
      });
    }
    return null;
  }

  function renderThread(container, messages, handlers = {}) {
    if (!container) return;
    container.replaceChildren();
    messages.forEach((message) => {
      const node = renderMessage(message, handlers);
      if (node) container.append(node);
    });
    container.scrollTop = container.scrollHeight;
  }

  global.PaligoInboxChat = {
    STORAGE_KEY,
    createId,
    getMessages,
    saveMessages,
    appendMessage,
    appendSystemMessage,
    upsertMessage,
    removeMessage,
    markInboxItemClaimed,
    getInboxItemClaim,
    bookSnapshot,
    resolveThreadId,
    resolvePeerThreadId,
    resolveThreadIdForSession,
    upsertBookMessage,
    recordBookSubmission,
    formatTime,
    renderTextBubble,
    renderSystemMessage,
    renderBookFlexCard,
    renderMessage,
    renderThread,
  };
})(typeof window !== "undefined" ? window : globalThis);
