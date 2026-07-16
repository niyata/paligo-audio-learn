/**
 * Paligo left sidebar — collapse/expand, accordion, flyout, mobile off-canvas.
 * Usage: PaligoSidebar.init({ activeHref: location.pathname });
 */
(function () {
  const STORAGE_KEY = "paligo-sidebar-collapsed-v1";
  const MOBILE_QUERY = "(max-width: 767px)";

  const ICONS = {
    study: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3a7 7 0 0 1 7 7v2h1a2 2 0 0 1 2 2v7H2v-7a2 2 0 0 1 2-2h1V10a7 7 0 0 1 7-7Z"/><path d="M9 18h6M10 14h4"/></svg>',
    exam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 4h10l3 3v13H7V4Z"/><path d="M17 4v4h3M9 12h8M9 16h6"/></svg>',
    review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4Z"/><path d="M9 12l2 2 4-4"/></svg>',
    prep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18v18H6.5A2.5 2.5 0 0 1 4 18.5V5.5Z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3V7a2 2 0 0 1 2-2Z"/><path d="M8 10h8M8 14h5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  };

  const SUPER_ADMIN_EMAILS = new Set(["tha.std@paligo.jp", "1.tha.tc@paligo.jp"]);

  function isSuperAdminUser(user) {
    if (!user) return false;
    if (typeof window !== "undefined" && window.PaligoPlatform?.isSuperAdmin) {
      return window.PaligoPlatform.isSuperAdmin(user);
    }
    if (user.isSuperAdmin) return true;
    const email = String(user.email || "").trim().toLowerCase();
    return SUPER_ADMIN_EMAILS.has(email);
  }

  function resolveMenu(options) {
    return options.menu || window.PaligoNavConfig?.menu || [];
  }

  function resolveBrand(options) {
    return options.brand || window.PaligoNavConfig?.brand || { title: "Paligo", subtitle: "เรียนบาลีออนไลน์" };
  }

  function resolveHomeHref() {
    return window.PaligoNavConfig?.homeHref || "index.html";
  }

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function normalizeHref(href) {
    if (!href) return "";
    try {
      const url = new URL(href, window.location.href);
      const name = url.pathname.split("/").pop() || "";
      return name + url.search;
    } catch {
      return href.split("#")[0];
    }
  }

  function currentPageRef() {
    const name = window.location.pathname.split("/").pop() || "";
    return name + window.location.search;
  }

  function currentPageName() {
    return window.location.pathname.split("/").pop()?.split("?")[0] || "";
  }

  function isFocusModePage(pageName) {
    const name = pageName || currentPageName();
    return Boolean(window.PaligoNavConfig?.pageMeta?.(name)?.focusMode);
  }

  function readCollapsed(pageName) {
    const name = pageName || currentPageName();
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value !== null) return value === "1";
    } catch {
      /* ignore */
    }
    /* หน้าเรียน (focusMode) พับเมนู · หน้า hub ขยายให้เห็นเมนูหลัก */
    return isFocusModePage(name);
  }

  function writeCollapsed(collapsed) {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function icon(name) {
    return ICONS[name] || ICONS.book;
  }

  function buildSubmenu(section, activeRef) {
    return section.children
      .map((item) => {
        const itemRef = normalizeHref(item.href);
        const active = itemRef === activeRef ? " is-active" : "";
        const inboxAttr = item.requiresInbox ? ' data-paligo-inbox-feature' : "";
        return `<li><a class="paligo-nav__sublink${active}" href="${item.href}"${inboxAttr}>${item.label}</a></li>`;
      })
      .join("");
  }

  function profileInitial(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
  }

  function buildAdminSidebarLink(activeRef) {
    const session =
      typeof window !== "undefined" ? window.PaligoInboxClient?.getSession?.() : null;
    if (!isSuperAdminUser(session?.user)) return "";

    const adminRef = normalizeHref("exam-super-admin.html");
    const active = adminRef === activeRef ? " is-active" : "";
    return `
      <a
        class="paligo-sidebar__admin-link${active}"
        href="exam-super-admin.html"
        data-tooltip="ตั้งค่าระบบ · Super Admin"
        aria-label="ตั้งค่าระบบ"
      >
        <span class="paligo-sidebar__admin-icon" aria-hidden="true">${icon("settings")}</span>
        <span class="paligo-sidebar__admin-label">ตั้งค่าระบบ</span>
      </a>`;
  }

  function buildAdminTopbarLink(activeRef) {
    const session =
      typeof window !== "undefined" ? window.PaligoInboxClient?.getSession?.() : null;
    if (!isSuperAdminUser(session?.user)) return "";

    const adminRef = normalizeHref("exam-super-admin.html");
    const active = adminRef === activeRef ? " is-active" : "";
    return `
      <a
        class="paligo-topbar__admin${active}"
        href="exam-super-admin.html"
        aria-label="ตั้งค่าระบบ"
        title="ตั้งค่าระบบ · Super Admin"
      >
        <span class="paligo-topbar__admin-icon" aria-hidden="true">${icon("settings")}</span>
        <span class="paligo-topbar__admin-label">ตั้งค่าระบบ</span>
      </a>`;
  }

  function buildProfileBlock() {
    const session =
      typeof window !== "undefined" ? window.PaligoInboxClient?.getSession?.() : null;
    const user = session?.user;
    const roleLabels = { student: "นักเรียน", reviewer: "ครู/ผู้ตรวจ" };

    const profileHref = user ? "exam-profile.html" : "exam-account.html";

    if (!user) {
      return `
        <a class="paligo-sidebar__profile paligo-sidebar__profile--guest" href="${profileHref}" data-tooltip="เข้าสู่ระบบ" aria-label="เข้าสู่ระบบ">
          <span class="paligo-sidebar__avatar" aria-hidden="true">?</span>
          <span class="paligo-sidebar__profile-text">
            <span class="paligo-sidebar__profile-name">เข้าสู่ระบบ</span>
            <span class="paligo-sidebar__profile-role">บัญชี Inbox</span>
          </span>
        </a>`;
    }

    const name = user.displayName || "ไม่ระบุชื่อ";
    const role = roleLabels[user.role] || user.role || "";
    const profileTooltip = `โปรไฟล์ · ${name}`;
    return `
      <a class="paligo-sidebar__profile" href="${profileHref}" data-tooltip="${profileTooltip}" aria-label="เปิดโปรไฟล์">
        <span class="paligo-sidebar__avatar" aria-hidden="true">${profileInitial(name)}</span>
        <span class="paligo-sidebar__profile-text">
          <span class="paligo-sidebar__profile-name">${name}</span>
          <span class="paligo-sidebar__profile-role">${role}</span>
        </span>
      </a>`;
  }

  function buildBrandBlock(brand) {
    const title = brand.title || "Paligo";
    const subtitle = brand.subtitle || "";
    const tooltip = subtitle ? `${title} · ${subtitle}` : title;
    const homeHref = resolveHomeHref();
    return `
      <a class="paligo-sidebar__brand" href="${homeHref}" data-tooltip="หน้าแรก · ${tooltip}" aria-label="กลับหน้าแรก — ${title}">
        <span class="paligo-sidebar__logo" aria-hidden="true">P</span>
        <div class="paligo-sidebar__title-wrap">
          <span class="paligo-sidebar__title">${title}</span>
          <span class="paligo-sidebar__subtitle">${subtitle}</span>
        </div>
      </a>`;
  }

  function buildFlyoutLinks(section, activeRef) {
    return section.children
      .map((item) => {
        const itemRef = normalizeHref(item.href);
        const active = itemRef === activeRef ? " is-active" : "";
        const inboxAttr = item.requiresInbox ? ' data-paligo-inbox-feature' : "";
        return `<a class="paligo-sidebar__flyout-link${active}" href="${item.href}"${inboxAttr}>${item.label}</a>`;
      })
      .join("");
  }

  function renderSidebar(menu, activeRef, brand) {
    const sections = menu
      .map((section) => {
        const submenuId = `paligo-submenu-${section.id}`;
        const openByDefault = section.children.some((item) => normalizeHref(item.href) === activeRef);
        return `
          <li class="paligo-nav__section">
            <button
              class="paligo-nav__trigger"
              type="button"
              data-section-id="${section.id}"
              aria-expanded="${openByDefault ? "true" : "false"}"
              aria-controls="${submenuId}"
              data-tooltip="${section.label}"
            >
              <span class="paligo-nav__icon">${icon(section.icon)}</span>
              <span class="paligo-nav__label">${section.label}</span>
              <span class="paligo-nav__chevron" aria-hidden="true">›</span>
            </button>
            <ul class="paligo-nav__submenu${openByDefault ? " is-open" : ""}" id="${submenuId}" role="group" aria-label="${section.label}">
              ${buildSubmenu(section, activeRef)}
            </ul>
          </li>`;
      })
      .join("");

    return `
      <aside class="paligo-sidebar" id="paligoSidebar" aria-label="เมนูหลัก">
        <div class="paligo-sidebar__header">
          ${buildBrandBlock(brand)}
          ${buildProfileBlock()}
        </div>
        <div class="paligo-sidebar__scroll">
          <nav aria-label="เมนูแอป">
            <ul class="paligo-nav">${sections}</ul>
          </nav>
        </div>
        <div class="paligo-sidebar__footer">
          ${buildAdminSidebarLink(activeRef)}
          <button
            class="paligo-sidebar__toggle"
            id="paligoSidebarToggle"
            type="button"
            aria-expanded="true"
            aria-controls="paligoSidebar"
            aria-label="พับเมนูด้านข้าง"
          >
            <span class="paligo-sidebar__toggle-icon" aria-hidden="true">${icon("chevronLeft")}</span>
            <span class="paligo-sidebar__toggle-label">พับเมนู</span>
          </button>
        </div>
      </aside>
      <div class="paligo-sidebar__tooltip" id="paligoSidebarTooltip" role="tooltip" hidden></div>
      <div class="paligo-sidebar__flyout" id="paligoSidebarFlyout" hidden></div>
      <div class="paligo-sidebar-backdrop" id="paligoSidebarBackdrop" hidden></div>`;
  }

  function buildInboxTopbarBlock(activeRef) {
    const session =
      typeof window !== "undefined" ? window.PaligoInboxClient?.getSession?.() : null;
    const user = session?.user;
    const role = user?.role || "guest";
    const roleLabels = { student: "นักเรียน", reviewer: "ครู/ผู้ตรวจ", guest: "ยังไม่ได้เข้าสู่ระบบ" };
    const items =
      window.PaligoNavConfig?.inboxMenuForRole?.(role) ||
      window.PaligoNavConfig?.inboxMenu?.guest ||
      [];

    const headMeta = user
      ? `${user.displayName || "ไม่ระบุชื่อ"} · ${roleLabels[role] || role}`
      : roleLabels.guest;

    const links = items
      .map((item) => {
        const itemRef = normalizeHref(item.href);
        const active = itemRef === activeRef ? " is-active" : "";
        const description = item.description
          ? `<span class="paligo-topbar__inbox-link-desc">${item.description}</span>`
          : "";
        const inboxAttr = item.requiresInbox ? ' data-paligo-inbox-feature' : "";
        return `<a class="paligo-topbar__inbox-link${active}" href="${item.href}"${inboxAttr}><span class="paligo-topbar__inbox-link-label">${item.label}</span>${description}</a>`;
      })
      .join("");

    const adminInboxLink = isSuperAdminUser(user)
      ? `<a class="paligo-topbar__inbox-link paligo-topbar__inbox-link--admin${normalizeHref("exam-super-admin.html") === activeRef ? " is-active" : ""}" href="exam-super-admin.html"><span class="paligo-topbar__inbox-link-label">ตั้งค่าระบบ</span><span class="paligo-topbar__inbox-link-desc">Super Admin · สวิตช์ฟีเจอร์</span></a>`
      : "";

    return `
      <div class="paligo-topbar__inbox" data-paligo-inbox-menu>
        <button
          class="paligo-topbar__inbox-trigger"
          id="paligoInboxMenuTrigger"
          type="button"
          aria-expanded="false"
          aria-controls="paligoInboxMenuPanel"
          aria-haspopup="menu"
          aria-label="เมนู Inbox"
          title="Inbox"
        >
          <span class="paligo-topbar__inbox-icon" aria-hidden="true">${icon("inbox")}</span>
          <span class="paligo-topbar__inbox-badge" data-paligo-inbox-badge${user ? "" : " hidden"} aria-hidden="true"></span>
        </button>
        <div class="paligo-topbar__inbox-panel" id="paligoInboxMenuPanel" role="menu" aria-label="เมนู Inbox" hidden>
          <div class="paligo-topbar__inbox-head">
            <span class="paligo-topbar__inbox-head-title">Inbox</span>
            <span class="paligo-topbar__inbox-head-meta">${headMeta}</span>
          </div>
          <div class="paligo-topbar__inbox-links">
            ${adminInboxLink}
            ${links}
          </div>
        </div>
      </div>`;
  }

  function renderTopbar(pageTitle, activeRef) {
    return `
      <header class="paligo-topbar">
        <button
          class="paligo-topbar__menu"
          id="paligoMobileMenu"
          type="button"
          aria-expanded="false"
          aria-controls="paligoSidebar"
          aria-label="เปิดเมนู"
        >
          ${icon("menu")}
        </button>
        <h1 class="paligo-topbar__title">${pageTitle}</h1>
        <div class="paligo-topbar__actions">
          <span class="paligo-topbar__hint">⌘B / Ctrl+B พับเมนู</span>
          ${buildAdminTopbarLink(activeRef)}
          ${buildInboxTopbarBlock(activeRef)}
        </div>
      </header>`;
  }

  function PaligoSidebarController(options) {
    this.options = options;
    this.menu = resolveMenu(options);
    this.activeName = normalizeHref(options.activeHref) || currentPageRef();
    this.collapsed = readCollapsed(this.activeName.split("?")[0]);
    this.mobileOpen = false;
    this.flyoutSectionId = null;

    this.app = document.querySelector(".paligo-app");
    this.sidebar = document.getElementById("paligoSidebar");
    this.toggle = document.getElementById("paligoSidebarToggle");
    this.mobileMenu = document.getElementById("paligoMobileMenu");
    this.backdrop = document.getElementById("paligoSidebarBackdrop");
    this.tooltip = document.getElementById("paligoSidebarTooltip");
    this.flyout = document.getElementById("paligoSidebarFlyout");
    this.inboxMenuTrigger = document.getElementById("paligoInboxMenuTrigger");
    this.inboxMenuPanel = document.getElementById("paligoInboxMenuPanel");
    this.inboxMenuOpen = false;

    this.bindEvents();
    this.applyState(false);
  }

  PaligoSidebarController.prototype.applyState = function (animate = true) {
    if (!this.app || !this.sidebar) return;

    const collapsed = !isMobile() && this.collapsed;
    this.app.classList.toggle("is-sidebar-collapsed", collapsed);
    this.sidebar.classList.toggle("is-collapsed", collapsed);
    this.app.classList.toggle("is-mobile-nav-open", isMobile() && this.mobileOpen);

    if (this.toggle) {
      this.toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      this.toggle.setAttribute("aria-label", collapsed ? "ขยายเมนูด้านข้าง" : "พับเมนูด้านข้าง");
      const toggleIcon = this.toggle.querySelector(".paligo-sidebar__toggle-icon");
      if (toggleIcon) {
        toggleIcon.innerHTML = collapsed ? icon("chevronRight") : icon("chevronLeft");
      }
      const toggleLabel = this.toggle.querySelector(".paligo-sidebar__toggle-label");
      if (toggleLabel) {
        toggleLabel.textContent = collapsed ? "ขยายเมนู" : "พับเมนู";
      }
    }

    if (this.mobileMenu) {
      this.mobileMenu.setAttribute("aria-expanded", this.mobileOpen ? "true" : "false");
      this.mobileMenu.setAttribute("aria-label", this.mobileOpen ? "ปิดเมนู" : "เปิดเมนู");
    }

    if (this.backdrop) {
      const showBackdrop = isMobile() && this.mobileOpen;
      this.backdrop.hidden = !showBackdrop;
      this.backdrop.classList.toggle("is-visible", showBackdrop);
    }

    if (!animate) {
      this.sidebar.style.transition = "none";
      requestAnimationFrame(() => {
        this.sidebar.style.transition = "";
      });
    }
  };

  PaligoSidebarController.prototype.setCollapsed = function (collapsed) {
    this.collapsed = collapsed;
    writeCollapsed(collapsed);
    this.closeFlyout();
    this.hideTooltip();
    this.applyState();
  };

  PaligoSidebarController.prototype.toggleCollapsed = function () {
    if (isMobile()) {
      this.toggleMobile();
      return;
    }
    this.setCollapsed(!this.collapsed);
  };

  PaligoSidebarController.prototype.toggleMobile = function () {
    this.mobileOpen = !this.mobileOpen;
    this.applyState();
  };

  PaligoSidebarController.prototype.closeMobile = function () {
    if (!this.mobileOpen) return;
    this.mobileOpen = false;
    this.applyState();
  };

  PaligoSidebarController.prototype.hideTooltip = function () {
    if (!this.tooltip) return;
    this.tooltip.classList.remove("is-visible");
    this.tooltip.hidden = true;
  };

  PaligoSidebarController.prototype.showTooltip = function (label, anchor) {
    if (!this.tooltip || !this.sidebar?.classList.contains("is-collapsed") || isMobile()) return;
    const rect = anchor.getBoundingClientRect();
    this.tooltip.textContent = label;
    this.tooltip.style.top = `${rect.top + rect.height / 2}px`;
    this.tooltip.hidden = false;
    this.tooltip.classList.add("is-visible");
  };

  PaligoSidebarController.prototype.closeFlyout = function () {
    if (!this.flyout) return;
    this.flyout.classList.remove("is-open");
    this.flyout.hidden = true;
    this.flyout.innerHTML = "";
    this.flyoutSectionId = null;
  };

  PaligoSidebarController.prototype.openFlyout = function (section, anchor) {
    if (!this.flyout || !this.sidebar?.classList.contains("is-collapsed") || isMobile()) return;
    const rect = anchor.getBoundingClientRect();
    this.flyout.innerHTML = `
      <p class="paligo-sidebar__flyout-title">${section.label}</p>
      ${buildFlyoutLinks(section, this.activeName)}
    `;
    this.flyout.style.top = `${Math.max(8, rect.top - 8)}px`;
    this.flyout.hidden = false;
    requestAnimationFrame(() => this.flyout.classList.add("is-open"));
    this.flyoutSectionId = section.id;
  };

  PaligoSidebarController.prototype.openAccordion = function (trigger, { closeOthers = true } = {}) {
    if (this.sidebar?.classList.contains("is-collapsed")) return;
    const submenu = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!submenu) return;

    if (closeOthers) {
      this.sidebar.querySelectorAll(".paligo-nav__trigger").forEach((other) => {
        if (other === trigger) return;
        other.setAttribute("aria-expanded", "false");
        const otherSubmenu = document.getElementById(other.getAttribute("aria-controls"));
        otherSubmenu?.classList.remove("is-open");
      });
    }

    trigger.setAttribute("aria-expanded", "true");
    submenu.classList.add("is-open");
  };

  PaligoSidebarController.prototype.resetAccordionToActive = function () {
    if (this.sidebar?.classList.contains("is-collapsed")) return;
    this.sidebar.querySelectorAll(".paligo-nav__trigger").forEach((trigger) => {
      const submenu = document.getElementById(trigger.getAttribute("aria-controls"));
      const hasActive = Boolean(submenu?.querySelector(".paligo-nav__sublink.is-active"));
      trigger.setAttribute("aria-expanded", hasActive ? "true" : "false");
      submenu?.classList.toggle("is-open", hasActive);
    });
  };

  PaligoSidebarController.prototype.toggleAccordion = function (trigger) {
    if (this.sidebar?.classList.contains("is-collapsed")) return;
    const submenu = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!submenu) return;

    const expanded = trigger.getAttribute("aria-expanded") === "true";
    if (expanded) {
      trigger.setAttribute("aria-expanded", "false");
      submenu.classList.remove("is-open");
      return;
    }

    this.openAccordion(trigger);
  };

  PaligoSidebarController.prototype.closeInboxMenu = function () {
    if (!this.inboxMenuPanel || !this.inboxMenuOpen) return;
    this.inboxMenuOpen = false;
    this.inboxMenuPanel.hidden = true;
    this.inboxMenuPanel.classList.remove("is-open");
    this.inboxMenuTrigger?.setAttribute("aria-expanded", "false");
  };

  PaligoSidebarController.prototype.openInboxMenu = function () {
    if (!this.inboxMenuPanel || !this.inboxMenuTrigger) return;
    this.closeFlyout();
    this.inboxMenuOpen = true;
    this.inboxMenuPanel.hidden = false;
    this.inboxMenuPanel.classList.add("is-open");
    this.inboxMenuTrigger.setAttribute("aria-expanded", "true");
  };

  PaligoSidebarController.prototype.toggleInboxMenu = function () {
    if (this.inboxMenuOpen) this.closeInboxMenu();
    else this.openInboxMenu();
  };

  PaligoSidebarController.prototype.bindEvents = function () {
    const self = this;

    this.toggle?.addEventListener("click", () => self.toggleCollapsed());
    this.mobileMenu?.addEventListener("click", () => self.toggleMobile());
    this.backdrop?.addEventListener("click", () => self.closeMobile());

    document.addEventListener("keydown", (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        self.toggleCollapsed();
      }
      if (event.key === "Escape") {
        self.closeFlyout();
        self.closeMobile();
        self.closeInboxMenu();
        self.hideTooltip();
      }
    });

    this.inboxMenuTrigger?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      self.toggleInboxMenu();
    });

    this.inboxMenuPanel?.addEventListener("click", (event) => {
      if (event.target.closest(".paligo-topbar__inbox-link")) {
        self.closeInboxMenu();
      }
    });

    document.addEventListener("click", (event) => {
      if (!self.inboxMenuOpen) return;
      if (
        event.target.closest("[data-paligo-inbox-menu]") ||
        event.target.closest("#paligoInboxMenuPanel")
      ) {
        return;
      }
      self.closeInboxMenu();
    });

    window.matchMedia(MOBILE_QUERY).addEventListener("change", () => {
      self.closeFlyout();
      self.closeInboxMenu();
      self.hideTooltip();
      self.closeMobile();
      self.applyState(false);
    });

    this.sidebar?.addEventListener("click", (event) => {
      const trigger = event.target.closest(".paligo-nav__trigger");
      if (!trigger) return;
      event.preventDefault();

      const sectionId = trigger.dataset.sectionId;
      const section = self.menu.find((item) => item.id === sectionId);
      if (!section) return;

      if (self.sidebar.classList.contains("is-collapsed")) {
        if (self.flyoutSectionId === sectionId) {
          self.closeFlyout();
        } else {
          self.openFlyout(section, trigger);
        }
        return;
      }

      self.toggleAccordion(trigger);
    });

    this.sidebar?.addEventListener("mouseover", (event) => {
      if (!self.sidebar.classList.contains("is-collapsed")) return;
      const anchor = event.target.closest("[data-tooltip]");
      if (!anchor) return;
      self.showTooltip(anchor.dataset.tooltip || "", anchor);
    });

    this.sidebar?.addEventListener("mouseout", (event) => {
      if (!self.sidebar.classList.contains("is-collapsed")) return;
      const anchor = event.target.closest("[data-tooltip]");
      if (!anchor) return;
      self.hideTooltip();
    });

    document.addEventListener("click", (event) => {
      if (!self.flyout?.classList.contains("is-open")) return;
      if (event.target.closest("#paligoSidebarFlyout") || event.target.closest(".paligo-nav__trigger")) {
        return;
      }
      self.closeFlyout();
    });

    this.flyout?.addEventListener("click", (event) => {
      if (event.target.closest(".paligo-sidebar__flyout-link")) {
        self.closeFlyout();
        self.closeMobile();
      }
    });

    this.sidebar?.addEventListener("click", (event) => {
      if (event.target.closest(".paligo-nav__sublink")) {
        self.closeMobile();
      }
    });
  };

  const BODY_OVERLAY_SELECTOR =
    "[data-paligo-overlay], [data-book-sheet], [data-chat-context-menu]";

  function isBodyOverlayNode(node) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      typeof node.matches === "function" &&
      node.matches(BODY_OVERLAY_SELECTOR)
    );
  }

  function wrapExistingContent(options) {
    const body = document.body;
    if (body.dataset.paligoShell === "ready") return;

    const pageTitle = options.pageTitle || document.title.split("·")[0].trim();
    const activeRef = normalizeHref(options.activeHref) || currentPageRef();
    const menu = resolveMenu(options);
    const brand = resolveBrand(options);
    const preservedNodes = [];
    const overlayNodes = [];

    for (const node of body.childNodes) {
      if (isBodyOverlayNode(node)) overlayNodes.push(node);
      else preservedNodes.push(node);
    }

    const wrapper = document.createElement("div");
    wrapper.className = "paligo-app";
    wrapper.innerHTML = `
      ${renderSidebar(menu, activeRef, brand)}
      <div class="paligo-main">
        ${renderTopbar(pageTitle, activeRef)}
        <div class="paligo-content" id="paligoMainContent"></div>
      </div>`;

    const contentHost = wrapper.querySelector("#paligoMainContent");
    preservedNodes.forEach((node) => contentHost.appendChild(node));

    body.replaceChildren(wrapper);
    overlayNodes.forEach((node) => body.appendChild(node));
    body.dataset.paligoShell = "ready";
  }

  window.PaligoSidebar = {
    getIcon: icon,
    init(options = {}) {
      wrapExistingContent(options);
      return new PaligoSidebarController(options);
    },
    autoInit(options = {}) {
      if (document.body.dataset.paligoShell === "ready") return null;
      const pageRef = currentPageRef();
      const config = window.PaligoNavConfig || {};
      const fallbackTitle = document.title.split("·")[0].trim();
      return PaligoSidebar.init({
        activeHref: pageRef,
        pageTitle: config.pageTitle?.(pageRef.split("?")[0], fallbackTitle) || fallbackTitle,
        menu: config.menu,
        brand: config.brand,
        ...options,
      });
    },
    mount(selector, options = {}) {
      const root = document.querySelector(selector);
      if (!root) return null;
      const menu = resolveMenu(options);
      const brand = resolveBrand(options);
      root.innerHTML = renderSidebar(menu, normalizeHref(options.activeHref) || currentPageRef(), brand);
      return new PaligoSidebarController(options);
    },
  };
})();
