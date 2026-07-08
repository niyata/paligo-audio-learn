import { chromium } from "playwright";

const STUDENT_USER = {
  id: "user-student",
  role: "student",
  displayName: "นายทดสอบ",
  email: "",
  createdAt: new Date().toISOString(),
  profileJson: {},
};

const SESSION = {
  sessionToken: "test-token",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: STUDENT_USER,
};

const REVIEWERS = [
  {
    id: "rev-1",
    displayName: "พระอาจารย์สมชาย",
    institution: "วัดป่าเชียงใหม่",
    reviewerRole: "teacher-reviewer",
    avatarUrl: null,
    isPaired: false,
  },
  {
    id: "rev-2",
    displayName: "พระมหาสมบูรณ์",
    institution: "สำนักเรียนวัดโพธิ์",
    reviewerRole: "teacher-reviewer",
    avatarUrl: null,
    isPaired: true,
  },
];

async function seed(page) {
  await page.addInitScript((session) => {
    localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
  }, SESSION);
}

async function onlineTest(browser) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);

  // Mock the Workers API online
  await page.route(/\/v1\//, (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (p.endsWith("/v1/health")) return json({ ok: true, service: "mock" });
    if (p.endsWith("/v1/me")) return json({ user: STUDENT_USER, pairing: null });
    if (p.endsWith("/v1/reviewers/search")) {
      const q = url.searchParams.get("q") || "";
      const filtered = REVIEWERS.filter((r) => !q || r.displayName.includes(q));
      return json({ schema: "paligo.inbox.reviewers.search.v1", query: q, reviewers: filtered });
    }
    return json({ ok: true });
  });

  await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);

  // Type partial name -> suggestions appear
  await page.click("[data-field-teacher-name]");
  await page.fill("[data-field-teacher-name]", "สม");
  await page.waitForTimeout(600);

  const suggestionCount = await page.evaluate(
    () => document.querySelectorAll("[data-teacher-listbox] .teacher-combobox__option").length
  );
  const expanded = await page.getAttribute("[data-field-teacher-name]", "aria-expanded");

  // Keyboard navigation: ArrowDown then Enter selects first
  await page.press("[data-field-teacher-name]", "ArrowDown");
  await page.press("[data-field-teacher-name]", "Enter");
  await page.waitForTimeout(200);

  const selectedValue = await page.inputValue("[data-field-teacher-name]");

  // Fill required name and save
  await page.fill("[data-field-first-name]", "สมชาย");
  await page.click("[data-save-profile]");
  await page.waitForTimeout(600);

  const savedProfile = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("paligo-exam-student-profile-v1::user-student") || "null")
  );

  // Reload and confirm the teacher selection persists
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const reloadedValue = await page.inputValue("[data-field-teacher-name]");

  await page.close();

  return {
    suggestionCount,
    expanded,
    selectedValue,
    savedTeacherName: savedProfile?.teacherName,
    savedTeacherUserId: savedProfile?.teacherUserId,
    savedTeacherInstitution: savedProfile?.teacherInstitution,
    reloadedValue,
    errors,
  };
}

async function offlineTest(browser) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page.route(/(:8788|:8787|:8790|:8791|\/v1\/)/, (r) => r.abort());

  await page.goto("http://127.0.0.1:8765/exam-profile.html", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1000);

  await page.click("[data-field-teacher-name]");
  await page.fill("[data-field-teacher-name]", "หลวงพ่อของฉันเอง");
  await page.waitForTimeout(700);

  const hintText = await page.evaluate(() => {
    const hint = document.querySelector("[data-teacher-hint]");
    return hint && !hint.hidden ? hint.textContent : "";
  });
  const listboxHidden = await page.evaluate(
    () => document.querySelector("[data-teacher-listbox]").hidden
  );

  await page.fill("[data-field-first-name]", "สมปอง");
  await page.click("[data-save-profile]");
  await page.waitForTimeout(500);

  const savedProfile = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("paligo-exam-student-profile-v1::user-student") || "null")
  );

  await page.close();

  return {
    hintText,
    listboxHidden,
    savedTeacherName: savedProfile?.teacherName,
    savedTeacherUserId: savedProfile?.teacherUserId,
    errors,
  };
}

async function main() {
  const browser = await chromium.launch();
  const online = await onlineTest(browser);
  const offline = await offlineTest(browser);
  await browser.close();

  const onlinePass =
    online.suggestionCount === 2 &&
    online.expanded === "true" &&
    online.selectedValue === "พระอาจารย์สมชาย" &&
    online.savedTeacherName === "พระอาจารย์สมชาย" &&
    online.savedTeacherUserId === "rev-1" &&
    online.savedTeacherInstitution === "วัดป่าเชียงใหม่" &&
    online.reloadedValue === "พระอาจารย์สมชาย" &&
    online.errors.length === 0;

  const offlinePass =
    /กรอกชื่อเองได้/.test(offline.hintText) &&
    offline.listboxHidden === true &&
    offline.savedTeacherName === "หลวงพ่อของฉันเอง" &&
    offline.savedTeacherUserId === "" &&
    offline.errors.length === 0;

  const pass = onlinePass && offlinePass;
  console.log(JSON.stringify({ online, offline, onlinePass, offlinePass, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
