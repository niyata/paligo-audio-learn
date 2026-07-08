/**
 * LINE LIFF shell — ประวัติส่ง inbox + แจ้งการส่ง
 * Notification badge ใช้ PaligoLineLiffNotify (script push)
 */
(function (global) {
  const LIFF_SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("โหลด LIFF SDK ไม่สำเร็จ"));
      document.head.appendChild(script);
    });
  }

  function getLiffId() {
    const cfg = global.PALIGO_CONFIG || {};
    const params = new URLSearchParams(global.location?.search || "");
    return params.get("liffId") || cfg.lineLiffId || global.PALIGO_LINE_LIFF_ID || "";
  }

  async function initLiff() {
    const liffId = getLiffId();
    if (!liffId) {
      return { inClient: false, reason: "no_liff_id" };
    }
    await loadScript(LIFF_SDK);
    if (!global.liff) throw new Error("LIFF SDK ไม่พร้อม");
    await global.liff.init({ liffId });
    return {
      inClient: global.liff.isInClient(),
      loggedIn: global.liff.isLoggedIn(),
      os: global.liff.getOS(),
    };
  }

  async function fetchInboxSummary() {
    const client = global.PaligoInboxClient;
    if (!client?.isLoggedIn?.()) {
      return { pendingInbox: 0, notifyQueued: 0 };
    }
    const data = await client.listInbox();
    const items = data.items || [];
    const role = client.getInboxRole?.();
    const pendingInbox = items.filter((item) => item.status === "pending").length;
    const notifyQueued = items.filter((item) => {
      if (item.status !== "pending") return false;
      if (role === "student") return item.direction === "to-student";
      if (role === "reviewer") return item.direction === "to-reviewer";
      return false;
    }).length;
    return { pendingInbox, notifyQueued: notifyQueued || pendingInbox };
  }

  function renderItems(items, role) {
    const list = document.querySelector("[data-line-liff-list]");
    const empty = document.querySelector("[data-line-liff-empty]");
    if (!list) return;

    list.replaceChildren();
    if (!items.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    const shared = global.PaligoExamShared;
    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "line-liff-item";
      const title = item.bookTitle || "สมุดข้อสอบ";
      const meta = `${item.fromDisplayName || "—"} · ป.ธ. ${item.grade || "—"} · ${item.subject || ""}`;
      row.innerHTML = `
        <h3 class="line-liff-item__title">${title}</h3>
        <p class="line-liff-item__meta">${meta}</p>
        <div class="line-liff-item__actions"></div>
      `;
      const actions = row.querySelector(".line-liff-item__actions");

      if (role === "student" && item.direction === "to-reviewer") {
        const notifyBtn = document.createElement("button");
        notifyBtn.type = "button";
        notifyBtn.className = "paligo-btn is-primary";
        notifyBtn.textContent = "แจ้งการส่ง";
        notifyBtn.addEventListener("click", async () => {
          await handleStudentNotify(item, notifyBtn);
        });
        actions.append(notifyBtn);
      }

      if (role === "student" && item.direction === "to-student" && item.status === "pending") {
        const claimBtn = document.createElement("button");
        claimBtn.type = "button";
        claimBtn.className = "paligo-btn is-primary";
        claimBtn.textContent = "รับผลตรวจ";
        claimBtn.addEventListener("click", async () => {
          try {
            const result = await global.PaligoInboxClient.claimInboxItem(item.id);
            shared?.importBookTransfer?.(result.bookTransfer);
            global.PaligoLineLiffNotify.showToast("รับผลตรวจแล้ว");
            await refreshPage();
          } catch (error) {
            global.PaligoLineLiffNotify.showToast(error.message || "รับผลไม่สำเร็จ");
          }
        });
        actions.append(claimBtn);
      }

      if (role === "reviewer" && item.status === "pending" && item.direction === "to-reviewer") {
        const openBtn = document.createElement("a");
        openBtn.className = "paligo-btn";
        openBtn.href = `exam-reviewer-console.html?inboxId=${encodeURIComponent(item.id)}`;
        openBtn.textContent = "เปิดตรวจ";
        actions.append(openBtn);
      }

      list.append(row);
    });
  }

  async function handleStudentNotify(item, button) {
    const notify = global.PaligoLineLiffNotify;
    button.disabled = true;
    try {
      // Phase 8.3: POST /v1/line/liff/notify — ตอนนี้ script push สถานะ local + toast
      const key = `paligo-line-notify-queued-${item.id}`;
      global.localStorage?.setItem(key, new Date().toISOString());
      notify.push({ notifyQueued: Math.max(1, notify.getState().notifyQueued), flash: true });
      notify.showToast("แจ้งการส่งแล้ว — ครูจะเห็นเมื่อเปิด LINE");

      if (global.liff?.isInClient?.() && global.liff.isLoggedIn?.()) {
        try {
          await global.liff.sendMessages([
            {
              type: "text",
              text: `PALIGO SEND ${item.id.slice(0, 8)}`,
            },
          ]);
        } catch {
          /* sendMessages ไม่บังคับ — UI หลักคือ script push */
        }
      }
      button.textContent = "แจ้งแล้ว";
    } catch (error) {
      button.disabled = false;
      notify.showToast(error.message || "แจ้งไม่สำเร็จ");
    }
  }

  async function refreshPage() {
    const client = global.PaligoInboxClient;
    await client?.ensureApiReady?.().catch(() => {});
    await client?.ensureAuthenticatedSession?.().catch(() => {});
    const summary = await fetchInboxSummary().catch(() => ({ pendingInbox: 0, notifyQueued: 0 }));
    global.PaligoLineLiffNotify.push(summary);
    if (client?.isLoggedIn?.()) {
      const data = await client.listInbox();
      renderItems(data.items || [], client.getInboxRole?.());
    }
  }

  async function bootstrap() {
    const gate = document.querySelector("[data-line-liff-gate]");
    const shell = document.querySelector("[data-line-liff-shell]");
    const status = document.querySelector("[data-line-liff-status]");

    try {
      const liffInfo = await initLiff();
      if (status) {
        status.textContent = liffInfo.inClient ? "เปิดใน LINE" : "เปิดในเบราว์เซอร์ (ทดสอบ)";
      }
    } catch (error) {
      if (status) status.textContent = error.message || "LIFF ไม่พร้อม";
    }

    try {
      await global.PaligoInboxClient?.ensureApiReady?.();
    } catch (error) {
      if (gate) {
        gate.hidden = false;
        shell.hidden = true;
        const msg = document.querySelector("[data-line-liff-gate-msg]");
        if (msg) msg.textContent = error.message || "API ไม่พร้อม";
      }
      return;
    }

    const session = await global.PaligoInboxClient?.ensureAuthenticatedSession?.();
    if (!session?.user) {
      if (gate) {
        gate.hidden = false;
        shell.hidden = true;
      }
      return;
    }

    if (gate) gate.hidden = true;
    if (shell) shell.hidden = false;

    const role = session.user.role;
    const title = document.querySelector("[data-line-liff-role-title]");
    if (title) {
      title.textContent = role === "reviewer" ? "งานส่งเข้ามา" : "ประวัติส่ง Inbox";
    }

    global.PaligoLineLiffNotify.setBadgeClickHandler(() => {
      const panel = document.querySelector("[data-line-liff-notify-panel]");
      if (panel) panel.hidden = !panel.hidden;
    });

    global.PaligoLineLiffNotify.startPoll(fetchInboxSummary, { intervalMs: 25000 });
    await refreshPage();

    document.querySelector("[data-line-liff-refresh]")?.addEventListener("click", refreshPage);
  }

  global.PaligoLineLiff = { initLiff, bootstrap, refreshPage, fetchInboxSummary };
  document.addEventListener("DOMContentLoaded", () => {
    bootstrap();
  });
})(typeof window !== "undefined" ? window : globalThis);
