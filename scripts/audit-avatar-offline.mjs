import { chromium } from "playwright";

const URL = "http://127.0.0.1:8765/exam-profile.html";

function session(role) {
  return {
    sessionToken: "test-token",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    user: {
      id: "user-" + role,
      role,
      displayName: role === "student" ? "นายทดสอบ ปุ่ม" : "พระอาจารย์ทดสอบ",
      email: "",
      createdAt: new Date().toISOString(),
      profileJson: {},
    },
  };
}

// 2x2 red PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAlXwMbmzXTHwAAAABJRU5ErkJggg==";

async function run(role) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript((s) => {
    localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(s));
  }, session(role));
  // Block the Workers API to force offline path.
  await page.route(/(:8788|:8787|\/v1\/)/, (r) => r.abort());

  await page.goto(URL, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1000);

  // Upload avatar via hidden input, then confirm crop modal
  await page.setInputFiles("[data-field-avatar-file]", {
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_BASE64, "base64"),
  });
  await page.waitForSelector(".avatar-crop-modal:not([hidden])", { timeout: 5000 });
  await page.click("[data-avatar-crop-save]");
  await page.waitForTimeout(300);

  const previewAfterPick = await page.evaluate(
    () => !!document.querySelector("[data-profile-avatar] img")
  );

  // Fill required name field so validation passes
  if (role === "student") {
    await page.fill("[data-field-first-name]", "ทดสอบ");
  } else {
    await page.fill("[data-field-reviewer-name]", "ทดสอบครู");
  }

  // Save profile (API offline)
  await page.click("[data-save-profile]");
  await page.waitForTimeout(400);

  const status = await page.evaluate(() => {
    const el = document.querySelector("[data-profile-status]");
    return {
      text: el?.textContent || "",
      isWarning: el?.classList.contains("is-warning"),
      isError: el?.classList.contains("is-error"),
    };
  });

  const stored = await page.evaluate((r) => {
    const base = r === "student"
      ? "paligo-exam-student-profile-v1"
      : "paligo-exam-reviewer-profile-v1";
    const scope = "user-" + r;
    const raw =
      localStorage.getItem(base + "::" + scope) ||
      localStorage.getItem(base + "::legacy") ||
      localStorage.getItem(base) ||
      "null";
    try {
      const parsed = JSON.parse(raw);
      return { hasAvatar: String(parsed?.avatarUrl || "").startsWith("data:image/") };
    } catch {
      return { hasAvatar: false };
    }
  }, role);

  // Reload and confirm avatar persists
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const previewAfterReload = await page.evaluate(
    () => !!document.querySelector("[data-profile-avatar] img")
  );

  await browser.close();

  return {
    role,
    previewAfterPick,
    status,
    stored,
    previewAfterReload,
    errors,
    pass:
      previewAfterPick &&
      status.isWarning &&
      !status.isError &&
      status.text.includes("บันทึกในเครื่อง") &&
      stored.hasAvatar &&
      previewAfterReload &&
      errors.length === 0,
  };
}

async function main() {
  const results = [];
  for (const role of ["student", "reviewer"]) {
    results.push(await run(role));
  }
  const pass = results.every((r) => r.pass);
  console.log(JSON.stringify({ results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
