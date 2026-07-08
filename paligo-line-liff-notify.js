/**
 * LIFF notification badge — **script push** (client DOM update)
 * ไม่ใช่ LINE Messaging API push / reply
 *
 * ใช้: PaligoLineLiffNotify.push({ pendingInbox: 2 })
 *      PaligoLineLiffNotify.startPoll(fetchSummary)
 */
(function (global) {
  const DEFAULT_STATE = {
    pendingInbox: 0,
    notifyQueued: 0,
    unread: 0,
  };

  let state = { ...DEFAULT_STATE };
  let pollTimer = null;
  let badgeEl = null;
  let panelEl = null;
  let toastEl = null;
  let onBadgeClick = null;

  function totalCount(next) {
    return Math.max(0, Number(next.pendingInbox || 0) + Number(next.notifyQueued || 0) + Number(next.unread || 0));
  }

  function toThaiNumber(value) {
    const digits = String(value ?? "");
    const map = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
    return digits.replace(/\d/g, (d) => map[Number(d)] || d);
  }

  function bindElements() {
    badgeEl = document.querySelector("[data-line-liff-notify-badge]");
    panelEl = document.querySelector("[data-line-liff-notify-panel]");
    toastEl = document.querySelector("[data-line-liff-toast]");
    const btn = document.querySelector("[data-line-liff-notify-btn]");
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        if (typeof onBadgeClick === "function") onBadgeClick(state);
        else if (panelEl) panelEl.hidden = !panelEl.hidden;
      });
    }
  }

  function renderBadge(options = {}) {
    bindElements();
    const count = totalCount(state);
    if (!badgeEl) return count;

    if (count > 0) {
      badgeEl.textContent = count > 99 ? "๙๙+" : toThaiNumber(count);
      badgeEl.classList.add("is-visible");
      if (options.flash) badgeEl.classList.add("is-pulse");
      else badgeEl.classList.remove("is-pulse");
    } else {
      badgeEl.textContent = "";
      badgeEl.classList.remove("is-visible", "is-pulse");
    }
    return count;
  }

  /**
   * Script push — อัปเดต badge จาก JS (poll / API / local event)
   * @param {Partial<typeof DEFAULT_STATE> & { flash?: boolean }>} patch
   */
  function push(patch = {}) {
    const prev = totalCount(state);
    state = { ...state, ...patch };
    const next = totalCount(state);
    const flash = patch.flash === true || next > prev;
    return renderBadge({ flash });
  }

  function reset() {
    state = { ...DEFAULT_STATE };
    return renderBadge();
  }

  function showToast(message, ms = 2200) {
    bindElements();
    if (!toastEl || !message) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    global.clearTimeout(showToast._timer);
    showToast._timer = global.setTimeout(() => {
      toastEl.classList.remove("is-visible");
    }, ms);
  }

  function setBadgeClickHandler(handler) {
    onBadgeClick = handler;
  }

  /**
   * @param {() => Promise<Partial<typeof DEFAULT_STATE>>} fetchSummary
   * @param {{ intervalMs?: number }} [options]
   */
  function startPoll(fetchSummary, options = {}) {
    const intervalMs = options.intervalMs || 30000;

    async function tick() {
      try {
        const summary = await fetchSummary();
        push(summary);
      } catch {
        /* เงียบ — LIFF อาจยังไม่ login */
      }
    }

    stopPoll();
    tick();
    pollTimer = global.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") tick();
    });
  }

  function stopPoll() {
    if (pollTimer) {
      global.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function getState() {
    return { ...state };
  }

  global.PaligoLineLiffNotify = {
    push,
    reset,
    showToast,
    setBadgeClickHandler,
    startPoll,
    stopPoll,
    getState,
    totalCount,
  };
})(typeof window !== "undefined" ? window : globalThis);
