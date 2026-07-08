import { chromium } from "playwright";

const URL = process.argv[2] || "http://127.0.0.1:8765/exam-reviewer-console.html";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 20000 });
const result = await page.evaluate(() => ({
  shell: document.body.dataset.paligoShell,
  sidebar: Boolean(document.getElementById("paligoSidebar")),
  app: Boolean(document.querySelector(".paligo-app")),
  topbar: Boolean(document.querySelector(".paligo-topbar")),
  sidebarVisible: (() => {
    const el = document.getElementById("paligoSidebar");
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  })(),
}));
console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.sidebar ? 0 : 1);
