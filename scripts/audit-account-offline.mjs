import { chromium } from "playwright";

const SESSION = {
  sessionToken: "test-token",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: {
    id: "user-student",
    role: "student",
    displayName: "นายทดสอบ",
    email: "",
    createdAt: new Date().toISOString(),
  },
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript((session) => {
    localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
    // ให้แน่ใจว่าไม่มี flag cache เปิด import/export ไว้ก่อน
    sessionStorage.removeItem("paligo-platform-flags-v1");
  }, SESSION);
  // Workers API offline
  await page.route(/(:8788|:8787|\/v1\/)/, (r) => r.abort());

  await page.goto("http://127.0.0.1:8765/exam-account.html", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => {
    const tab = document.querySelector("[data-paligo-import-export-tab]");
    const panel = document.querySelector("[data-paligo-import-export]");
    const status = document.querySelector("[data-api-status]")?.textContent || "";
    return {
      tabVisible: tab && !tab.hidden,
      statusText: status,
    };
  });

  // Click the advanced tab and confirm the panel + local tools show
  let panelVisible = false;
  let hasLocalTools = false;
  if (state.tabVisible) {
    await page.click("[data-paligo-import-export-tab]").catch(() => {});
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const panel = document.querySelector("[data-paligo-import-export]");
      const exportBtn = panel?.querySelector("button, [data-export], input[type=file]");
      return { panelVisible: panel && !panel.hidden, hasLocalTools: !!exportBtn };
    });
    panelVisible = after.panelVisible;
    hasLocalTools = after.hasLocalTools;
  }

  await browser.close();

  const pass =
    state.tabVisible &&
    /ในเครื่อง|โอนไฟล์|ใช้ได้/.test(state.statusText) &&
    panelVisible &&
    hasLocalTools &&
    errors.length === 0;

  console.log(JSON.stringify({ state, panelVisible, hasLocalTools, errors, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
