/**
 * แหล่งความจริงเดียวของเมนูนำทาง Paligo — อย่า hardcode รายการเมนูใน HTML แต่ละหน้า
 * ดู PRD: docs/navigation-and-shell-prd.md
 */
(function () {
  const MENU = [
    {
      id: "study",
      label: "เรียนวันนี้",
      icon: "study",
      priority: 1,
      children: [
        {
          label: "ฝึกแปลด้วยเสียง",
          href: "pali-audio-hightlight.html",
          description: "ฟังและไฮไลท์คำบาลีตามเสียง",
        },
        {
          label: "อ่านหน้าเล่ม",
          href: "book-page-viewer.html",
          description: "เปิดหน้าเล่มจาก manifest",
        },
      ],
    },
    {
      id: "exam",
      label: "ฝึกทำข้อสอบ",
      icon: "exam",
      priority: 2,
      children: [
        {
          label: "เริ่มทำข้อสอบ",
          href: "ruled-lines-card-only-template.html?newBook=1",
          description: "สร้างสมุดคำตอบใหม่",
        },
        {
          label: "สมุดข้อสอบของฉัน",
          href: "exam-books.html",
          description: "เปิด ส่งออก หรือนำเข้าสมุด",
        },
        {
          label: "ทำต่อเล่มล่าสุด",
          href: "ruled-lines-card-only-template.html?resume=1",
          description: "เปิดเล่มที่ทำค้างไว้",
        },
        {
          label: "ผลตรวจของฉัน",
          href: "exam-review-results.html",
          description: "นำเข้าไฟล์ผลตรวจจากครู",
        },
        {
          label: "บัญชี Inbox",
          href: "exam-account.html",
          description: "สมัคร เข้าสู่ระบบ จับคู่ครู–นักเรียน",
        },
      ],
    },
    {
      id: "review",
      label: "ครูและผู้ตรวจ",
      icon: "review",
      priority: 3,
      children: [
        {
          label: "ตรวจข้อสอบ",
          href: "exam-reviewer-console.html",
          description: "นำเข้า submission และ stamp คะแนน",
        },
        {
          label: "ตารางคะแนน",
          href: "exam-leaderboard.html",
          description: "ดูผลคะแนนจากการตรวจ",
        },
      ],
    },
    {
      id: "prep",
      label: "เตรียมเล่ม",
      icon: "prep",
      priority: 4,
      children: [
        {
          label: "ตรวจหน้าเล่ม (QA)",
          href: "book-page-qa.html",
          description: "เทียบ PDF กับ HTML หลังแปลงเล่ม",
        },
      ],
    },
  ];

  const PAGES = {
    "pali-audio-hightlight.html": {
      title: "ฝึกแปลด้วยเสียง",
      section: "study",
      focusMode: true,
    },
    "book-page-viewer.html": {
      title: "อ่านหน้าเล่ม",
      section: "study",
      focusMode: true,
    },
    "ruled-lines-card-only-template.html": {
      title: "ทำข้อสอบ",
      section: "exam",
      focusMode: true,
    },
    "ruled-lines-template.html": {
      title: "ทำข้อสอบ",
      section: "exam",
      focusMode: true,
    },
    "exam-books.html": {
      title: "สมุดข้อสอบของฉัน",
      section: "exam",
    },
    "exam-review-results.html": {
      title: "ผลตรวจของฉัน",
      section: "exam",
    },
    "exam-account.html": {
      title: "บัญชี Inbox",
      section: "exam",
    },
    "exam-reviewer-console.html": {
      title: "ตรวจข้อสอบ",
      section: "review",
    },
    "exam-leaderboard.html": {
      title: "ตารางคะแนน",
      section: "review",
    },
    "book-page-qa.html": {
      title: "ตรวจหน้าเล่ม",
      section: "prep",
    },
    "app-shell-demo.html": {
      title: "ตัวอย่างเมนู",
      section: "prep",
    },
  };

  const STUDY_PAGE_NAMES = Object.entries(PAGES)
    .filter(([, meta]) => meta.focusMode)
    .map(([name]) => name);

  function pageMeta(href) {
    const name = (href || "").split("?")[0].split("/").pop() || "";
    return PAGES[name] || null;
  }

  function pageTitle(href, fallbackTitle) {
    const name = (href || "").split("?")[0].split("/").pop() || "";
    return pageMeta(name)?.title || fallbackTitle || "Paligo";
  }

  window.PaligoNavConfig = {
    brand: {
      title: "Paligo",
      subtitle: "เรียนบาลีออนไลน์",
    },
    menu: MENU,
    pages: PAGES,
    studyPageNames: STUDY_PAGE_NAMES,
    pageMeta,
    pageTitle,
  };
})();
