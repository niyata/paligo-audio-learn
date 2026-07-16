/**
 * Platform feature gates — import/export visibility + super admin helpers
 */
(function (global) {
  const FLAGS_CACHE_KEY = "paligo-platform-flags-v1";
  const SUPER_ADMIN_EMAILS = new Set(["tha.std@paligo.jp", "1.tha.tc@paligo.jp"]);

  /** Issue #78 — ซ่อน Import/Export ชั่วคราวจาก UI (อย่าลบ gate/logic เดิม) */
  const IMPORT_EXPORT_UI_TEMPORARILY_HIDDEN = true;

  const DEFAULT_FLAGS = {
    importExportEnabled: false,
    inboxEnabled: true,
    lineWebhookEnabled: false,
    lineMessagingEnabled: false,
    lineNotifyQueueEnabled: false,
    notificationsEnabled: true,
    crawlerIndexingAllowed: false,
    maintenanceMode: false,
    debugApiLogs: false,
  };

  function readCache() {
    try {
      return JSON.parse(global.sessionStorage?.getItem(FLAGS_CACHE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeCache(flags) {
    try {
      global.sessionStorage?.setItem(FLAGS_CACHE_KEY, JSON.stringify(flags));
    } catch {
      /* ignore */
    }
  }

  function isSuperAdmin(user) {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    const email = String(user.email || "").trim().toLowerCase();
    return SUPER_ADMIN_EMAILS.has(email);
  }

  async function fetchFlags({ force = false } = {}) {
    if (!force) {
      const cached = readCache();
      if (cached?.flags) return cached.flags;
    }

    const client = global.PaligoInboxClient;
    if (client?.getPlatformFlags) {
      try {
        const payload = await client.getPlatformFlags();
        const flags = { ...DEFAULT_FLAGS, ...(payload?.flags || {}) };
        writeCache({ flags, fetchedAt: Date.now() });
        return flags;
      } catch {
        /* fall through */
      }
    }

    return { ...DEFAULT_FLAGS };
  }

  function canUseImportExport(user, flags) {
    if (IMPORT_EXPORT_UI_TEMPORARILY_HIDDEN) return false;
    if (isSuperAdmin(user)) return true;
    return Boolean(flags?.importExportEnabled);
  }

  function canUseInbox(user, flags) {
    if (isSuperAdmin(user)) return true;
    const cfg = global.PALIGO_CONFIG;
    if (cfg?.features?.inbox === false) return false;
    return flags?.inboxEnabled !== false;
  }

  function applyImportExportGate(flags, user, { offlineFallback = false } = {}) {
    // เดิม: offlineFallback เปิดทางสำรองเมื่อ API offline — ปิดชั่วคราว (#78)
    const allowed =
      !IMPORT_EXPORT_UI_TEMPORARILY_HIDDEN &&
      (offlineFallback || canUseImportExport(user, flags));
    const nodes = global.document?.querySelectorAll(
      "[data-paligo-import-export], [data-paligo-import-export-tab]"
    );
    nodes?.forEach((node) => {
      node.hidden = !allowed;
      node.setAttribute("aria-hidden", allowed ? "false" : "true");
    });

    global.document?.body?.classList.toggle("paligo-import-export-enabled", allowed);
    global.document?.body?.classList.toggle("paligo-import-export-disabled", !allowed);
    return allowed;
  }

  function applyInboxGate(flags, user) {
    const allowed = canUseInbox(user, flags);
    const nodes = global.document?.querySelectorAll("[data-paligo-inbox-feature]");
    nodes?.forEach((node) => {
      node.hidden = !allowed;
      node.setAttribute("aria-hidden", allowed ? "false" : "true");
    });

    global.document?.body?.classList.toggle("paligo-inbox-enabled", allowed);
    global.document?.body?.classList.toggle("paligo-inbox-disabled", !allowed);
    return allowed;
  }

  function applyMaintenanceBanner(flags) {
    const doc = global.document;
    if (!doc?.body) return;

    const existing = doc.getElementById("paligoMaintenanceBanner");
    if (!flags?.maintenanceMode) {
      existing?.remove();
      doc.body.classList.remove("paligo-maintenance-active");
      return;
    }

    if (!existing) {
      const banner = doc.createElement("div");
      banner.id = "paligoMaintenanceBanner";
      banner.className = "paligo-maintenance-banner";
      banner.setAttribute("role", "status");
      banner.textContent = "ปิดปรับปรุงชั่วคราว — บางฟีเจอร์ใช้ไม่ได้";
      doc.body.prepend(banner);
    }

    doc.body.classList.add("paligo-maintenance-active");
  }

  function applyCrawlerPolicy(flags) {
    const doc = global.document;
    if (!doc?.head) return false;
    const allowed = Boolean(flags?.crawlerIndexingAllowed);
    let meta = doc.querySelector('meta[name="robots"][data-paligo-crawler-policy]');
    if (!meta) {
      meta = doc.createElement("meta");
      meta.name = "robots";
      meta.dataset.paligoCrawlerPolicy = "true";
      doc.head.append(meta);
    }
    meta.content = allowed ? "index,follow" : "noindex,nofollow,noarchive,nosnippet,noimageindex";
    doc.body?.classList.toggle("paligo-crawler-indexing-allowed", allowed);
    doc.body?.classList.toggle("paligo-crawler-indexing-blocked", !allowed);
    return allowed;
  }

  async function boot(options = {}) {
    const user = options.user ?? global.PaligoInboxClient?.getSession?.()?.user ?? null;
    const offlineFallback = Boolean(options.offline);
    const flags = await fetchFlags({ force: Boolean(options.force) });
    const importExportAllowed = applyImportExportGate(flags, user, { offlineFallback });
    applyInboxGate(flags, user);
    applyMaintenanceBanner(flags);
    const crawlerIndexingAllowed = applyCrawlerPolicy(flags);
    return {
      flags,
      user,
      offline: offlineFallback,
      importExportAllowed,
      inboxAllowed: canUseInbox(user, flags),
      crawlerIndexingAllowed,
    };
  }

  async function ensureSuperAdminPage(redirect = "exam-profile.html") {
    const client = global.PaligoInboxClient;
    const session = await client?.ensureAuthenticatedSession?.();
    const user = session?.user;
    if (!isSuperAdmin(user)) {
      global.location.href = redirect;
      return null;
    }
    return user;
  }

  global.PaligoPlatform = {
    SUPER_ADMIN_EMAILS,
    IMPORT_EXPORT_UI_TEMPORARILY_HIDDEN,
    DEFAULT_FLAGS,
    isSuperAdmin,
    fetchFlags,
    canUseImportExport,
    canUseInbox,
    applyImportExportGate,
    applyInboxGate,
    applyMaintenanceBanner,
    applyCrawlerPolicy,
    boot,
    ensureSuperAdminPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
