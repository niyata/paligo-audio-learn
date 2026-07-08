import { chromium } from "playwright";

const USER_ID = "user-student";
const REVIEWER_ID = "rev-1";
const THREAD_ID = `student-${USER_ID}-${REVIEWER_ID}`;

const SESSION = {
  sessionToken: "test-token",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  user: { id: USER_ID, role: "student", displayName: "นายทดสอบ", email: "", createdAt: new Date().toISOString() },
};

const PAIRING = {
  userId: USER_ID,
  ctx: { pairing: { reviewerUserId: REVIEWER_ID, reviewerDisplayName: "ครูเอก" } },
};

const now = new Date().toISOString();
const mkBook = (id, grade, subject, day) => ({
  id,
  schema: "paligo.exam.answerBook.v1",
  ownerId: USER_ID,
  title: `สมุดคำตอบ ป.ธ. ${grade} · แปลมคธเป็นไทย · ${day} ม.ค. 2569`,
  studentName: "นายทดสอบ",
  grade: String(grade),
  subject,
  status: "draft",
  revision: 1,
  createdAt: now,
  updatedAt: now,
  draft: {
    schema: "paligo.exam.answerBookDraft.v1",
    ownerId: USER_ID,
    bookId: id,
    pickers: [
      { type: "grade", value: String(grade) },
      { type: "subject", value: subject },
      { type: "day", value: String(day) },
      { type: "month", value: "1" },
      { type: "year", value: "2569" },
    ],
    pages: ["คำตอบทดสอบ"],
    annotations: [],
    savedAt: now,
  },
});

const BOOKS = [
  mkBook("book-1", 4, "pali-to-thai", 1),
  mkBook("book-2", 5, "pali-to-thai", 2),
  mkBook("book-3", 6, "thai-to-pali", 3),
];

async function main() {
  const browser = await chromium.launch();
  const errors = [];

  const results = {};

  for (const [label, viewport] of [
    ["desktop", { width: 1200, height: 900 }],
    ["mobile", { width: 390, height: 780 }],
  ]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));

    await page.addInitScript(
      ({ session, pairing, books, threadId, userId }) => {
        localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
        localStorage.setItem("paligo-inbox-pairing-cache-v1", JSON.stringify(pairing));
        localStorage.setItem(`paligo-exam-answer-books-v1::${userId}`, JSON.stringify(books));
        localStorage.setItem(`paligo-inbox-chat-v1::${userId}::${threadId}`, JSON.stringify([]));
      },
      { session: SESSION, pairing: PAIRING, books: BOOKS, threadId: THREAD_ID, userId: USER_ID }
    );
    await page.route(/(:8788|:8787|:8790|:8791|\/v1\/)/, (r) => r.abort());

    await page.goto("http://127.0.0.1:8765/exam-inbox.html", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1000);

    // Open the book sheet
    await page.click("[data-open-book-menu]");
    await page.waitForTimeout(500);

    const measure = await page.evaluate(() => {
      const list = document.querySelector("[data-book-sheet-list]");
      const picks = Array.from(document.querySelectorAll(".inbox-book-pick"));
      const covers = Array.from(document.querySelectorAll(".inbox-book-pick .book-cover.is-portrait"));
      const gridCols = getComputedStyle(list).gridTemplateColumns.split(" ").length;
      const first = covers[0]?.getBoundingClientRect();
      const isPortrait = first ? first.height > first.width : false;
      const panel = document.querySelector(".inbox-book-sheet__panel")?.getBoundingClientRect();
      // check no overflow beyond viewport
      const overflow = panel ? panel.right > window.innerWidth + 1 || panel.left < -1 : false;
      return {
        pickCount: picks.length,
        coverCount: covers.length,
        gridCols,
        isPortrait,
        coverW: first ? Math.round(first.width) : 0,
        coverH: first ? Math.round(first.height) : 0,
        overflow,
      };
    });

    // Select first book -> confirm area shows
    await page.click(".inbox-book-pick");
    await page.waitForTimeout(300);
    const afterSelect = await page.evaluate(() => {
      const confirm = document.querySelector("[data-book-sheet-confirm]");
      const selected = document.querySelector(".inbox-book-pick.is-selected");
      const confirmText = document.querySelector("[data-book-sheet-confirm-text]")?.textContent || "";
      return {
        confirmVisible: confirm && !confirm.hidden,
        hasSelected: !!selected,
        confirmText,
      };
    });

    // Search filter
    await page.fill("[data-book-sheet-search]", "ป.ธ. 6");
    await page.waitForTimeout(300);
    const afterSearch = await page.evaluate(
      () => document.querySelectorAll(".inbox-book-pick").length
    );

    results[label] = { measure, afterSelect, afterSearch };
    await page.close();
  }

  // Regression: chat card cover should still be non-portrait compact
  const page2 = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page2.on("pageerror", (e) => errors.push(`chatcard: ${e.message}`));
  const chatHistory = [
    {
      id: "inbox-x1",
      type: "book",
      direction: "in",
      bookId: "book-1",
      book: { id: "book-1", title: "สมุดคำตอบ ป.ธ. 4", grade: "4", subject: "pali-to-thai", revision: 1, status: "under_review" },
      bookStatus: "under_review",
      senderName: "ครูเอก",
      at: now,
    },
  ];
  await page2.addInitScript(
    ({ session, pairing, threadId, userId, history }) => {
      localStorage.setItem("paligo-inbox-session-v1", JSON.stringify(session));
      localStorage.setItem("paligo-inbox-pairing-cache-v1", JSON.stringify(pairing));
      localStorage.setItem(`paligo-inbox-chat-v1::${userId}::${threadId}`, JSON.stringify(history));
    },
    { session: SESSION, pairing: PAIRING, threadId: THREAD_ID, userId: USER_ID, history: chatHistory }
  );
  await page2.route(/(:8788|:8787|:8790|:8791|\/v1\/)/, (r) => r.abort());
  await page2.goto("http://127.0.0.1:8765/exam-inbox.html", { waitUntil: "networkidle", timeout: 20000 });
  await page2.waitForTimeout(1000);
  const chatCard = await page2.evaluate(() => {
    const cover = document.querySelector(".inbox-flex-card__hero .book-cover");
    return {
      hasCover: !!cover,
      isPortrait: cover ? cover.classList.contains("is-portrait") : false,
      isCompact: cover ? cover.classList.contains("is-compact") : false,
    };
  });
  await page2.close();

  await browser.close();

  const d = results.desktop;
  const m = results.mobile;
  const pass =
    d.measure.pickCount === 3 &&
    d.measure.coverCount === 3 &&
    d.measure.isPortrait &&
    d.measure.gridCols >= 3 &&
    !d.measure.overflow &&
    d.afterSelect.confirmVisible &&
    d.afterSelect.hasSelected &&
    d.afterSearch === 1 &&
    m.measure.pickCount === 3 &&
    m.measure.isPortrait &&
    m.measure.gridCols >= 2 &&
    !m.measure.overflow &&
    m.afterSelect.confirmVisible &&
    // regression: chat card cover unchanged
    chatCard.hasCover &&
    !chatCard.isPortrait &&
    chatCard.isCompact &&
    errors.length === 0;

  console.log(JSON.stringify({ results, chatCard, errors, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
