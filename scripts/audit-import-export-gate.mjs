/**
 * Issue #78 — Import/Export JSON ซ่อนชั่วคราวจาก UI
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STUDENT_SESSION = {
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

const SUPER_ADMIN_SESSION = {
  sessionToken: "admin-token",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: {
    id: "user-admin",
    role: "reviewer",
    displayName: "Super Admin",
    email: "tha.std@paligo.jo",
    isSuperAdmin: true,
    createdAt: new Date().toISOString(),
  },
};

function staticChecks() {
  const errors = [];
  const platformJs = readFileSync(join(ROOT, "paligo-platform.js"), "utf8");
  const superAdminHtml = readFileSync(join(ROOT, "exam-super-admin.html"), "utf8");
  const accountHtml = readFileSync(join(ROOT, "exam-account.html"), "utf8");

  if (!platformJs.includes("IMPORT_EXPORT_UI_TEMPORARILY_HIDDEN = true")) {
    errors.push("paligo-platform.js: missing temporary hide flag");
  }
  if (!platformJs.includes("importExportEnabled: false")) {
    errors.push("paligo-platform.js: default importExportEnabled not false");
  }
  if (!/key:\s*"importExportEnabled"[\s\S]*?live:\s*false/.test(superAdminHtml)) {
    errors.push("exam-super-admin.html: importExportEnabled not future/disabled toggle");
  }
  if (accountHtml.includes("node.hidden = false") && accountHtml.includes("data-paligo-import-export")) {
    errors.push("exam-account.html: still reveals import/export on boot failure");
  }

  return { errors };
}

async function browserChecks() {
  const browser = await chromium.launch();
  const errors = [];
  const results = {};

  // --- account offline: tab must stay hidden ---
  {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    page.on("pageerror", (e) => errors.push(`account: ${e.message}`));

    await page.addInitScript((session) => {
      localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
      sessionStorage.removeItem("paligo-platform-flags-v1");
    }, STUDENT_SESSION);
    await page.route(/(:8788|:8787|\/v1\/)/, (r) => r.abort());

    await page.goto("http://127.0.0.1:8765/exam-account.html", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);

    results.accountOffline = await page.evaluate(() => {
      const tab = document.querySelector("[data-paligo-import-export-tab]");
      const panel = document.querySelector("[data-paligo-import-export]");
      const loginTab = document.querySelector('[data-tab="login"]');
      const registerTab = document.querySelector('[data-tab="register"]');
      return {
        tabHidden: !tab || tab.hidden,
        panelHidden: !panel || panel.hidden,
        statusText: document.querySelector("[data-api-status]")?.textContent || "",
        hasLoginTab: !!loginTab,
        hasRegisterTab: !!registerTab,
      };
    });

    if (!results.accountOffline.tabHidden) errors.push("account offline: import tab visible");
    if (!results.accountOffline.panelHidden) errors.push("account offline: import panel visible");
    if (/โอนไฟล์.*ใช้ได้|เครื่องมือโอนไฟล์/.test(results.accountOffline.statusText)) {
      errors.push("account offline: status still advertises file transfer");
    }

    await page.close();
  }

  // --- super admin: importExport toggle is future/disabled, save other flags ---
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    page.on("pageerror", (e) => errors.push(`super-admin: ${e.message}`));

    let savedFlags = null;
    await page.addInitScript((session) => {
      localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
      sessionStorage.removeItem("paligo-platform-flags-v1");
    }, SUPER_ADMIN_SESSION);

    await page.route("**/v1/**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes("/v1/admin/panel") && method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            flags: {
              importExportEnabled: true,
              inboxEnabled: true,
              notificationsEnabled: true,
            },
            user: SUPER_ADMIN_SESSION.user,
            stats: { users: 3, activePairings: 1, inboxPending: 0 },
            health: { ok: true },
          }),
        });
      }
      if (url.includes("/v1/admin/settings") && method === "PATCH") {
        savedFlags = JSON.parse(route.request().postData() || "{}");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, flags: savedFlags }),
        });
      }
      if (url.includes("/v1/platform/flags")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            flags: {
              importExportEnabled: true,
              inboxEnabled: true,
              notificationsEnabled: false,
            },
          }),
        });
      }
      if (url.includes("/v1/health")) {
        return route.fulfill({ status: 200, body: '{"ok":true}' });
      }
      return route.abort();
    });

    await page.goto("http://127.0.0.1:8765/exam-super-admin.html", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForSelector("[data-admin-shell]:not([hidden])", { timeout: 10000 });

    results.superAdmin = await page.evaluate(() => {
      const row = document.querySelector('[data-flag-key="importExportEnabled"]')?.closest(".admin-toggle");
      const inboxInput = document.querySelector('[data-flag-key="inboxEnabled"]');
      return {
        importRowIsFuture: row?.classList.contains("is-future") ?? false,
        importInputDisabled: document.querySelector('[data-flag-key="importExportEnabled"]')?.disabled ?? false,
        importLabelHasFuture: row?.textContent?.includes("เร็วๆ นี้") ?? false,
        inboxChecked: inboxInput?.checked ?? false,
      };
    });

    if (!results.superAdmin.importRowIsFuture) errors.push("super admin: importExport row not future");
    if (!results.superAdmin.importInputDisabled) errors.push("super admin: importExport input not disabled");

    await page.locator('[data-flag-key="notificationsEnabled"]').uncheck();
    await page.click("[data-save-settings]");
    await page.waitForTimeout(600);

    results.superAdmin.savedFlags = savedFlags;
    results.superAdmin.statusText = await page.locator("[data-admin-status]").textContent().catch(() => "");

    if (!savedFlags) errors.push("super admin: save did not PATCH settings");
    const flagsPayload = savedFlags?.flags || savedFlags;
    if (flagsPayload && flagsPayload.importExportEnabled !== false) {
      errors.push("super admin: importExportEnabled must stay false while UI hidden");
    }
    if (flagsPayload && flagsPayload.notificationsEnabled !== false) {
      errors.push("super admin: live toggles not saved");
    }

    await page.close();
  }

  // --- profile + inbox smoke: no import/export UI even with cached flag true ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on("pageerror", (e) => errors.push(`smoke: ${e.message}`));

    await page.addInitScript((session) => {
      localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
      sessionStorage.setItem(
        "paligo-platform-flags-v1",
        JSON.stringify({
          flags: { importExportEnabled: true, inboxEnabled: true },
          fetchedAt: Date.now(),
        })
      );
    }, STUDENT_SESSION);
    await page.route(/\/v1\//, (r) => r.abort());

    await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("body.is-role-student", { timeout: 10000 });

    const profileHidden = await page.evaluate(() => {
      const nodes = document.querySelectorAll("[data-paligo-import-export], [data-paligo-import-export-tab]");
      return [...nodes].every((n) => n.hidden);
    });
    results.profileNoImportUi = profileHidden;
    if (!profileHidden) errors.push("profile: import/export nodes visible despite cache flag");

    await page.goto("http://127.0.0.1:8765/exam-inbox.html", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1200);

    const inboxHidden = await page.evaluate(() => {
      const nodes = document.querySelectorAll("[data-paligo-import-export], [data-paligo-import-export-tab]");
      return [...nodes].every((n) => !n || n.hidden);
    });
    results.inboxNoImportUi = inboxHidden;
    if (!inboxHidden) errors.push("inbox: import/export nodes visible");

    await page.close();
  }

  await browser.close();
  return { results, errors };
}

const staticResult = staticChecks();
const browserResult = await browserChecks();
const pass = staticResult.errors.length === 0 && browserResult.errors.length === 0;

console.log(
  JSON.stringify(
    {
      staticOk: staticResult.errors.length === 0,
      staticErrors: staticResult.errors,
      ...browserResult.results,
      errors: [...staticResult.errors, ...browserResult.errors],
      pass,
    },
    null,
    2
  )
);

process.exit(pass ? 0 : 1);
