/**
 * Paligo app shell — เรียกหลัง DOM พร้อมและโหลด nav config + sidebar แล้ว
 * ใช้ defer ใน <head> หรือเรียก PaligoShell.boot() ท้าย <body>
 */
(function (global) {
  function boot() {
    if (document.body?.dataset.paligoShell === "ready") {
      return global.__paligoSidebarController || null;
    }

    if (!global.PaligoSidebar?.autoInit) {
      console.warn(
        "[Paligo] Shell ไม่พร้อม — โหลด paligo-nav-config.js และ sidebar-nav.js ก่อน paligo-shell-init.js"
      );
      return null;
    }

    const controller = global.PaligoSidebar.autoInit();
    global.__paligoSidebarController = controller;
    controller?.resetAccordionToActive?.();
    return controller;
  }

  global.PaligoShell = { boot };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
