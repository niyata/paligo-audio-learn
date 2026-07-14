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
    const loginTab = document.querySelector('[data-tab="login"]');
    return {
      tabHidden: !tab || tab.hidden,
      panelHidden: !panel || panel.hidden,
      statusText: status,
      hasLoginTab: !!loginTab,
    };
  });

  await browser.close();

  const pass =
    state.tabHidden &&
    state.panelHidden &&
    !/โอนไฟล์.*ใช้ได้|เครื่องมือโอนไฟล์/.test(state.statusText) &&
    state.hasLoginTab &&
    errors.length === 0;

  console.log(JSON.stringify({ state, errors, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
