import { chromium } from "playwright";

const USER_ID = "user-student";
const REVIEWER_ID = "rev-1";
const THREAD_ID = `student-${USER_ID}-${REVIEWER_ID}`;

const SESSION = {
  sessionToken: "test-token",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: {
    id: USER_ID,
    role: "student",
    displayName: "นายทดสอบ",
    email: "",
    createdAt: new Date().toISOString(),
  },
};

const PAIRING = {
  userId: USER_ID,
  ctx: {
    pairing: { reviewerUserId: REVIEWER_ID, reviewerDisplayName: "ครูเอก" },
  },
};

const HISTORY = [
  {
    id: "msg-existing-1",
    type: "text",
    direction: "out",
    text: "สวัสดีครับอาจารย์",
    at: new Date(Date.now() - 60000).toISOString(),
  },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript(
    ({ session, pairing, history, threadId, userId }) => {
      localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
      localStorage.setItem("paligo-inbox-pairing-cache-v1", JSON.stringify(pairing));
      localStorage.setItem(
        `paligo-inbox-chat-v1::${userId}::${threadId}`,
        JSON.stringify(history)
      );
    },
    { session: SESSION, pairing: PAIRING, history: HISTORY, threadId: THREAD_ID, userId: USER_ID }
  );
  // Simulate Workers API completely offline
  await page.route(/(:8788|:8787|\/v1\/)/, (r) => r.abort());

  await page.goto("http://127.0.0.1:8765/exam-inbox.html", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1200);

  const state1 = await page.evaluate((threadId) => {
    const shell = document.querySelector("[data-inbox-shell]");
    const gate = document.querySelector("[data-inbox-gate]");
    const banner = document.querySelector("[data-sync-status]");
    const key = `paligo-inbox-chat-v1::user-student::${threadId}`;
    const msgs = JSON.parse(localStorage.getItem(key) || "[]");
    return {
      shellVisible: shell && !shell.hidden,
      gateVisible: gate && !gate.hidden,
      bannerVisible: banner && !banner.hidden,
      threadMsgCount: document.querySelectorAll("[data-chat-thread] .inbox-flex-card, [data-chat-thread] [data-message-id]").length,
      historyLen: msgs.length,
      systemMsgs: msgs.filter((m) => m.type === "system").length,
    };
  }, THREAD_ID);

  // Click refresh/retry multiple times — must NOT append duplicate system/error messages
  for (let i = 0; i < 3; i++) {
    await page.click("[data-refresh-chat]").catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.click("[data-sync-retry]").catch(() => {});
  await page.waitForTimeout(400);

  const state2 = await page.evaluate((threadId) => {
    const key = `paligo-inbox-chat-v1::user-student::${threadId}`;
    const msgs = JSON.parse(localStorage.getItem(key) || "[]");
    const banner = document.querySelector("[data-sync-status]");
    return {
      historyLen: msgs.length,
      systemMsgs: msgs.filter((m) => m.type === "system").length,
      bannerVisible: banner && !banner.hidden,
    };
  }, THREAD_ID);

  await browser.close();

  const pass =
    state1.shellVisible &&
    !state1.gateVisible &&
    state1.bannerVisible &&
    state1.historyLen === 1 &&
    state1.systemMsgs === 0 &&
    // after several refreshes, no duplicate/error messages appended
    state2.historyLen === 1 &&
    state2.systemMsgs === 0 &&
    errors.length === 0;

  console.log(JSON.stringify({ state1, state2, errors, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
