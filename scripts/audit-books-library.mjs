import { chromium } from "playwright";

const USER_ID = "user-student";
const now = new Date().toISOString();
const mkBook = (id, extra = {}) => ({
  id,
  schema: "paligo.exam.answerBook.v1",
  ownerId: USER_ID,
  title: `สมุดคำตอบ ป.ธ. 4 · แปลมคธเป็นไทย · 1 ม.ค. 2569`,
  studentName: `นักเรียน ${id}`,
  grade: "4",
  subject: "pali-to-thai",
  status: "draft",
  revision: 1,
  createdAt: now,
  updatedAt: now,
  draft: {
    schema: "paligo.exam.answerBookDraft.v1",
    ownerId: USER_ID,
    bookId: id,
    pickers: [
      { type: "grade", value: "4" },
      { type: "subject", value: "pali-to-thai" },
      { type: "day", value: "1" },
      { type: "month", value: "1" },
      { type: "year", value: "2569" },
    ],
    pages: ["คำตอบ"],
    annotations: [],
    savedAt: now,
  },
  ...extra,
});

const BOOKS = [
  mkBook("book-a"),
  mkBook("book-b", { isFavorite: true }),
  mkBook("book-c"),
];

async function runViewport(browser, viewport, label) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));

  const mockUser = {
    id: USER_ID,
    role: "student",
    displayName: "ทดสอบ",
    email: "",
    createdAt: now,
  };
  await page.route("**/v1/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: mockUser }),
    })
  );

  await page.addInitScript(
    ({ books, userId }) => {
      localStorage.setItem(
        "paligo-inbox-session-v1",
        JSON.stringify({
          sessionToken: "t",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          user: { id: userId, role: "student", displayName: "ทดสอบ", email: "", createdAt: new Date().toISOString() },
        })
      );
      localStorage.setItem(`paligo-exam-answer-books-v1::${userId}`, JSON.stringify(books));
      localStorage.setItem("paligo-exam-active-book-id-v1::user-student", "book-a");
    },
    { books: BOOKS, userId: USER_ID }
  );

  await page.goto("http://127.0.0.1:8765/exam-books.html", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1200);

  const initial = await page.evaluate(() => ({
    cards: document.querySelectorAll(".book-card").length,
    hearts: document.querySelectorAll(".book-card-favorite").length,
    selects: document.querySelectorAll(".book-card-select").length,
    viewTabs: document.querySelectorAll("[data-books-view]").length,
    createBtn: !!document.querySelector("[data-open-cover-modal]"),
    openLinks: document.querySelectorAll('a.button.is-primary[href*="ruled-lines"]').length,
  }));

  // Toggle favorite on first card
  await page.locator(".book-card").first().locator(".book-card-favorite").click();
  await page.waitForTimeout(200);

  const afterFavorite = await page.evaluate(() => {
    const books = JSON.parse(localStorage.getItem("paligo-exam-answer-books-v1::user-student") || "[]");
    const c = books.find((b) => b.id === "book-c");
    return { isFavorite: !!c?.isFavorite };
  });

  // Multi select 2 books
  const selectBtns = page.locator(".book-card-select");
  await selectBtns.nth(0).click();
  await selectBtns.nth(2).click();
  await page.waitForTimeout(200);

  const selection = await page.evaluate(() => ({
    toolbarVisible: !document.querySelector("[data-books-selection-toolbar]").hidden,
    countText: document.querySelector("[data-books-selection-count]")?.textContent || "",
  }));

  // Bulk hide
  await page.click("[data-bulk-hide]");
  await page.waitForTimeout(200);
  await page.click('[data-close-book-alert]');
  await page.waitForTimeout(300);

  const afterHide = await page.evaluate(() => {
    const books = JSON.parse(localStorage.getItem("paligo-exam-answer-books-v1::user-student") || "[]");
    const c = books.find((b) => b.id === "book-c");
    return {
      hiddenAt: c?.hiddenAt || null,
      allViewCards: document.querySelectorAll(".book-card").length,
    };
  });

  // Switch to hidden view
  await page.click('[data-books-view="hidden"]');
  await page.waitForTimeout(300);
  const hiddenView = await page.evaluate(() => document.querySelectorAll(".book-card").length);

  // Switch to favorites view
  await page.click('[data-books-view="favorites"]');
  await page.waitForTimeout(300);
  const favView = await page.evaluate(() => document.querySelectorAll(".book-card").length);

  // Trash one book from all view
  await page.click('[data-books-view="all"]');
  await page.waitForTimeout(200);
  await page.locator(".book-card-select").first().click();
  await page.click("[data-bulk-trash]");
  await page.waitForTimeout(200);
  await page.click('[data-close-book-alert]');
  await page.waitForTimeout(300);

  const afterTrash = await page.evaluate(() => {
    const books = JSON.parse(localStorage.getItem("paligo-exam-answer-books-v1::user-student") || "[]");
    const trashed = books.filter((b) => b.trashedAt);
    const stillInStorage = books.length;
    return { trashedCount: trashed.length, stillInStorage };
  });

  await page.click('[data-books-view="trash"]');
  await page.waitForTimeout(300);
  const trashView = await page.evaluate(() => ({
    cards: document.querySelectorAll(".book-card").length,
    submitHidden: Array.from(document.querySelectorAll(".book-card button")).every(
      (btn) => btn.textContent !== "ส่งตรวจ" || btn.hidden
    ),
  }));

  // Mobile overflow check
  const toolbarBox = await page.locator("[data-books-selection-toolbar]").boundingBox().catch(() => null);
  const overflow = toolbarBox ? toolbarBox.width > viewport.width + 2 : false;

  await page.close();

  return {
    label,
    initial,
    afterFavorite,
    selection,
    afterHide,
    hiddenView,
    favView,
    afterTrash,
    trashView,
    overflow,
    errors,
  };
}

async function main() {
  const browser = await chromium.launch();
  const desktop = await runViewport(browser, { width: 1200, height: 900 }, "desktop");
  const mobile = await runViewport(browser, { width: 390, height: 780 }, "mobile");
  await browser.close();

  const pass =
    desktop.initial.cards === 3 &&
    desktop.initial.hearts === 3 &&
    desktop.initial.selects === 3 &&
    desktop.initial.viewTabs === 4 &&
    desktop.afterFavorite.isFavorite &&
    desktop.selection.toolbarVisible &&
    /เลือกแล้ว 2 เล่ม/.test(desktop.selection.countText) &&
    desktop.afterHide.hiddenAt &&
    desktop.afterHide.allViewCards === 1 &&
    desktop.hiddenView === 2 &&
    desktop.favView >= 1 &&
    desktop.afterTrash.trashedCount === 1 &&
    desktop.afterTrash.stillInStorage === 3 &&
    desktop.trashView.cards === 1 &&
    desktop.trashView.submitHidden &&
    !desktop.overflow &&
    mobile.initial.cards >= 1 &&
    !mobile.overflow &&
    desktop.errors.length === 0 &&
    mobile.errors.length === 0;

  console.log(JSON.stringify({ desktop, mobile, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
