import { chromium } from "playwright";

const SESSION = {
  sessionToken: "test-token",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: {
    id: "user-student",
    role: "student",
    displayName: "นายทดสอบ ปุ่ม",
    email: "",
    createdAt: new Date().toISOString(),
    profileJson: {},
  },
};

// Saved student profile with name parts but NO canonical studentName (the #64 bug case)
const STUDENT_PROFILE = {
  userRole: "student",
  prefix: "พระ",
  firstName: "สมชาย",
  lastName: "ใจดี",
  monasticName: "ธมฺมชโย",
  grade: "5",
  teacherName: "อาจารย์เอก",
  teacherRole: "teacher-reviewer",
  deliveryMethod: "line",
  displayAlias: "",
  avatarUrl: "data:image/jpeg;base64,/9j/AAAA",
  updatedAt: new Date().toISOString(),
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript(
    ({ session, profile }) => {
      localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
      localStorage.setItem(
        "paligo-exam-student-profile-v1::user-student",
        JSON.stringify(profile)
      );
    },
    { session: SESSION, profile: STUDENT_PROFILE }
  );
  await page.route(/(:8788|:8787|\/v1\/)/, (r) => r.abort());

  await page.goto("http://127.0.0.1:8765/exam-books.html", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1000);

  // ---- #64: buildStudentProfileSnapshot derives studentName + full snapshot ----
  const snapshot = await page.evaluate(() => window.PaligoExamShared.buildStudentProfileSnapshot());

  // legacy-only studentName still works
  const legacyName = await page.evaluate(() =>
    window.PaligoExamShared.deriveStudentName({ studentName: "นายเก่า" })
  );

  // ---- #65: create a new book, confirm hydration ----
  const created = await page.evaluate(() => {
    const form = document.querySelector("[data-cover-form]");
    form.elements.grade.value = "5";
    form.elements.subject.value = form.elements.subject.options[0]?.value || "pali-to-thai";
    form.elements.day.value = "1";
    form.elements.month.value = "1";
    form.elements.year.value = "2569";
    form.requestSubmit();
    // createBookWithCover writes to localStorage synchronously before redirect
    const books = JSON.parse(
      localStorage.getItem("paligo-exam-answer-books-v1::user-student") || "[]"
    );
    const newest = books[0] || null;
    return newest
      ? {
          studentName: newest.studentName,
          hasDraftProfile: !!newest.draft?.profile,
          draftProfileName: newest.draft?.profile?.studentName || "",
          draftProfileGrade: newest.draft?.profile?.grade || "",
          draftProfileAvatar: String(newest.draft?.profile?.avatarUrl || "").startsWith("data:image/"),
        }
      : null;
  });

  await browser.close();

  const expectedName = "พระ สมชาย ใจดี (ธมฺมชโย)";
  const pass =
    snapshot &&
    snapshot.studentName === expectedName &&
    snapshot.prefix === "พระ" &&
    snapshot.firstName === "สมชาย" &&
    snapshot.monasticName === "ธมฺมชโย" &&
    snapshot.teacherName === "อาจารย์เอก" &&
    String(snapshot.avatarUrl || "").startsWith("data:image/") &&
    legacyName === "นายเก่า" &&
    created &&
    created.studentName === expectedName &&
    created.hasDraftProfile &&
    created.draftProfileName === expectedName &&
    created.draftProfileGrade === "5" &&
    created.draftProfileAvatar &&
    errors.length === 0;

  console.log(JSON.stringify({ snapshot, legacyName, created, errors, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
