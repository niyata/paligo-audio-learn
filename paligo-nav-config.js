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
          label: "ฝึกแปลจากตำรา",
          href: "pali-translation-practice.html",
          description: "อ่านชุดแปล 3 เล่มโดยไม่ใช้เสียงเทป",
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
          href: "workbook.html?newBook=1",
          description: "สร้างสมุดข้อสอบใหม่",
        },
        {
          label: "สมุดข้อสอบของฉัน",
          href: "exam-books.html",
          description: "จัดการสมุดข้อสอบ · ส่งตรวจ",
        },
        {
          label: "ทำต่อเล่มล่าสุด",
          href: "workbook.html?resume=1",
          description: "เปิดสมุดที่ค้างไว้",
        },
        {
          label: "กล่องข้อความ",
          href: "inbox.html",
          description: "ส่งสมุดให้ครูในแชท",
          requiresInbox: true,
        },
        {
          label: "ผลตรวจของฉัน",
          href: "exam-review-results.html",
          description: "นำเข้าไฟล์ผลตรวจจากครู",
        },
        {
          label: "โปรไฟล์",
          href: "exam-profile.html",
          description: "ตั้งค่าชื่อบนปก · จับคู่ · บัญชี",
        },
        {
          label: "บัญชี Inbox",
          href: "exam-account.html",
          description: "เข้าสู่ระบบ · สำรองข้อมูล",
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
          label: "Inbox แชท",
          href: "inbox.html",
          description: "รับสมุดจากนักเรียนในรูปแบบแชท",
          requiresInbox: true,
        },
        {
          label: "โปรไฟล์",
          href: "exam-profile.html",
          description: "ตั้งค่าชื่อ · รหัสเชิญ · บัญชี",
        },
        {
          label: "Inbox งานส่งตรวจ",
          href: "exam-reviewer-console.html",
          description: "รับงานที่นักเรียนส่งเข้ามา",
        },
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

  const HOME_HREF = "index.html";

  const PAGES = {
    "index.html": {
      title: "หน้าแรก",
      section: null,
    },
    "pali-audio-hightlight.html": {
      title: "ฝึกแปลด้วยเสียง",
      section: "study",
      focusMode: true,
    },
    "pali-translation-practice.html": {
      title: "ฝึกแปลจากตำรา",
      section: "study",
      focusMode: true,
    },
    "book-page-viewer.html": {
      title: "อ่านหน้าเล่ม",
      section: "study",
      focusMode: true,
    },
    "workbook.html": {
      title: "ทำข้อสอบ",
      section: "exam",
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
    "exam-inbox.html": {
      title: "กล่องข้อความ",
      section: "exam",
    },
    "inbox.html": {
      title: "กล่องข้อความ",
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
    "exam-profile.html": {
      title: "โปรไฟล์",
      section: "exam",
    },
    "exam-super-admin.html": {
      title: "Super Admin",
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
    "seed-demo-books.html": {
      title: "สร้างสมุดตัวอย่าง",
      section: "exam",
    },
  };

  const STUDY_PAGE_NAMES = Object.entries(PAGES)
    .filter(([, meta]) => meta.focusMode)
    .map(([name]) => name);

  const INBOX_MENU = {
    guest: [
      {
        label: "กล่องข้อความ",
        href: "inbox.html",
        description: "ส่งสมุดให้ครู · แชท Inbox",
        requiresInbox: true,
      },
      {
        label: "โปรไฟล์",
        href: "exam-profile.html",
        description: "ตั้งค่าชื่อบนปก · จับคู่",
      },
      {
        label: "เข้าสู่ระบบ",
        href: "exam-account.html",
        description: "บัญชี Inbox",
      },
    ],
    student: [
      {
        label: "กล่องข้อความ",
        href: "inbox.html",
        description: "แชทส่งสมุดให้ครู",
        requiresInbox: true,
      },
      {
        label: "โปรไฟล์",
        href: "exam-profile.html",
        description: "ตั้งค่าชื่อ · จับคู่ · บัญชี",
      },
      {
        label: "สมุดข้อสอบ",
        href: "exam-books.html",
        description: "จัดการสมุดข้อสอบ",
      },
      {
        label: "ผลตรวจของฉัน",
        href: "exam-review-results.html",
        description: "ดูผลตรวจจากครู",
      },
      {
        label: "บัญชี Inbox",
        href: "exam-account.html",
        description: "เข้าสู่ระบบ · สำรองข้อมูล",
      },
    ],
    reviewer: [
      {
        label: "โปรไฟล์",
        href: "exam-profile.html",
        description: "ตั้งค่าชื่อ · รหัสเชิญ",
      },
      {
        label: "Inbox แชท",
        href: "inbox.html",
        description: "รับสมุดจากนักเรียน",
        requiresInbox: true,
      },
      {
        label: "งานส่งตรวจ",
        href: "exam-reviewer-console.html",
        description: "รับงานเข้าคลังตรวจ",
      },
      {
        label: "ตารางคะแนน",
        href: "exam-leaderboard.html",
        description: "ดูอันดับคะแนน",
      },
      {
        label: "บัญชี Inbox",
        href: "exam-account.html",
        description: "เข้าสู่ระบบ · สำรองข้อมูล",
      },
    ],
  };

  function inboxMenuForRole(role) {
    if (role === "reviewer") return INBOX_MENU.reviewer;
    if (role === "student") return INBOX_MENU.student;
    return INBOX_MENU.guest;
  }

  function pageMeta(href) {
    const name = (href || "").split("?")[0].split("/").pop() || "";
    return PAGES[name] || null;
  }

  function pageTitle(href, fallbackTitle) {
    const name = (href || "").split("?")[0].split("/").pop() || "";
    return pageMeta(name)?.title || fallbackTitle || "Paligo";
  }

  window.PaligoNavConfig = {
    homeHref: HOME_HREF,
    brand: {
      title: "Paligo",
      subtitle: "เรียนบาลีออนไลน์",
    },
    menu: MENU,
    pages: PAGES,
    studyPageNames: STUDY_PAGE_NAMES,
    inboxMenu: INBOX_MENU,
    inboxMenuForRole,
    pageMeta,
    pageTitle,
  };
})();
