import { chromium } from "playwright";

const URL = "http://127.0.0.1:8765/exam-profile.html";

const SESSION = {
  sessionToken: "test-token",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: {
    id: "user-test-1",
    role: "student",
    displayName: "นายทดสอบ ปุ่ม",
    email: "",
    createdAt: new Date().toISOString(),
    profileJson: {},
  },
};

async function seed(page) {
  await page.addInitScript((session) => {
    localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
  }, SESSION);
  // Force offline API so the cached session is trusted (network error path).
  await page.route(/(:8788|:8787|\/v1\/)/, (route) => route.abort());
}

async function main() {
  const browser = await chromium.launch();
  const results = {};

  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page);
    await page.goto(URL, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1200);

    // Measure all visible .paligo-btn + .profile-tab heights
    const heights = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".paligo-btn, .profile-tab"));
      return nodes
        .filter((n) => n.offsetParent !== null)
        .map((n) => ({
          text: n.textContent.trim().slice(0, 16),
          h: Math.round(n.getBoundingClientRect().height),
          cls: n.className,
        }));
    });

    const belowTarget = heights.filter((b) => b.h < 44);

    // Overflow check: buttons within container width
    const overflow = await page.evaluate(() => {
      const shell = document.querySelector(".profile-card");
      if (!shell) return [];
      const rect = shell.getBoundingClientRect();
      return Array.from(document.querySelectorAll(".paligo-btn, .profile-tab"))
        .filter((n) => n.offsetParent !== null)
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.right > rect.right + 1 || r.left < rect.left - 1;
        })
        .map((n) => n.textContent.trim().slice(0, 16));
    });

    results[viewport.name] = {
      totalButtons: heights.length,
      belowTarget,
      overflow,
      errors,
    };

    await page.close();
  }

  // Keyboard tab navigation on desktop
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await seed(page);
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.querySelector('[data-profile-tab="profile"]').focus());
  await page.keyboard.press("ArrowRight");
  const afterArrow = await page.evaluate(() => ({
    active: document.querySelector(".profile-tab.is-active")?.dataset.profileTab,
    focused: document.activeElement?.dataset?.profileTab,
    ariaSelected: document.querySelector('[data-profile-tab="connections"]')?.getAttribute("aria-selected"),
    panelVisible: !document.querySelector('[data-profile-panel="connections"]')?.hidden,
  }));
  results.keyboard = afterArrow;
  await page.close();

  await browser.close();

  const pass =
    results.desktop.belowTarget.length === 0 &&
    results.mobile.belowTarget.length === 0 &&
    results.desktop.overflow.length === 0 &&
    results.mobile.overflow.length === 0 &&
    results.desktop.errors.length === 0 &&
    results.mobile.errors.length === 0 &&
    results.keyboard.active === "connections" &&
    results.keyboard.panelVisible === true;

  console.log(JSON.stringify({ ...results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
