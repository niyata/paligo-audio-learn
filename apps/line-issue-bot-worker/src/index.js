import { handleLineIssueWebhook } from "../../../packages/line-issue-bot-core/src/index.js";

const SERVICE_NAME = "line-issue-bot-worker";
const DEFAULT_ISSUE_COMMAND =
  "/issue repo:paligo p:0 agent:integrator area:inbox refactor inbox naming และ compatibility route";

export default {
  async fetch(request, env) {
    if (request.method.toUpperCase() === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if ((path === "/" || path === "/health") && request.method.toUpperCase() === "GET") {
      const origin = publicOrigin(request, env);
      return jsonResponse({
        ok: true,
        service: SERVICE_NAME,
        origin,
        webhook: `${origin}/webhook`,
        liff: `${origin}/liff`,
        aliases: Object.keys(readRepoConfig(env)),
        storage: {
          drafts: Boolean(env.LINE_ISSUE_DRAFTS),
          assets: Boolean(env.LINE_ISSUE_ASSETS),
        },
      });
    }

    if (path === "/liff" && request.method.toUpperCase() === "GET") {
      return htmlResponse(renderLiffPage(env));
    }

    if (path.startsWith("/assets/") && request.method.toUpperCase() === "GET") {
      return handleAssetRequest(request, env, path.slice("/assets/".length));
    }

    if (
      (path === "/webhook" || path === "/v1/line/issues/webhook") &&
      request.method.toUpperCase() === "POST"
    ) {
      return handleLineIssueWebhook(request, env);
    }

    return jsonResponse({ error: "not_found", message: `ไม่พบ ${request.method} ${path}` }, 404);
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function readRepoConfig(env) {
  const raw = String(env.ISSUE_BOT_REPOS_JSON || "").trim();
  if (!raw) return { paligo: { repo: "niyata/paligo-audio-learn" } };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function handleAssetRequest(request, env, key) {
  if (!env.LINE_ISSUE_ASSETS) {
    return jsonResponse({ error: "assets_unavailable", message: "R2 binding ไม่พร้อม" }, 503);
  }
  const cleanKey = decodeURIComponent(String(key || "")).replace(/^\/+/, "");
  if (!cleanKey || cleanKey.includes("..")) {
    return jsonResponse({ error: "invalid_asset_key", message: "asset key ไม่ถูกต้อง" }, 400);
  }
  const object = await env.LINE_ISSUE_ASSETS.get(cleanKey);
  if (!object) {
    return jsonResponse({ error: "asset_not_found", message: "ไม่พบไฟล์" }, 404);
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

function publicOrigin(request, env) {
  const configured = String(env.ISSUE_BOT_PUBLIC_ORIGIN || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  return url.origin;
}

function renderLiffPage(env) {
  const liffId = String(env.LINE_LIFF_ID || "");
  const oaId = String(env.LINE_OA_ID || "");
  const command = DEFAULT_ISSUE_COMMAND;
  const repos = readRepoConfig(env);
  const repoAliases = Object.keys(repos);
  const allowedUserIds = readAllowedUserIds(env);
  const liffRequiresAuth = allowedUserIds !== null;
  const workflowSteps = [
    ["1", "Capture", "รับโจทย์จาก LINE/LIFF พร้อมรูปหรือ URL"],
    ["2", "Triage", "เลือก repo, priority, agent, area"],
    ["3", "Confirm", "สร้าง draft card ให้ PO ตรวจและยืนยัน"],
    ["4", "Execute", "สร้าง GitHub issue แล้วส่งต่อ AI/agent"],
  ];
  const agentRoles = [
    ["Integrator", "agent:integrator", "เคลมงานค้างข้าม agent, refactor ใหญ่, compatibility route, launch blocker"],
    ["Codex", "agent:codex", "logic, Worker/API, webhook, storage, tests, production hardening"],
    ["Cursor", "agent:cursor", "UX/UI, Tailwind, responsive, mobile, Apple HIG-ish visual polish"],
    ["Claude", "agent:claude", "PRD, copy, บาลี/ตำรา, lesson content, requirement shaping"],
    ["Human/PO", "agent:human", "อนุมัติ scope, policy, payment, product decision, final acceptance"],
  ];
  const commandTemplates = [
    ["Integrator", "Refactor / compatibility / launch", "/issue repo:paligo p:0 agent:integrator area:pipeline {{task}}"],
    ["Codex", "Logic / Worker / API", "/issue repo:paligo p:1 agent:codex area:pipeline {{task}}"],
    ["Cursor", "UX/UI / Tailwind / mobile", "/issue repo:paligo p:1 agent:cursor area:inbox {{task}}"],
    ["Claude", "PRD / บาลี / เนื้อหา", "/issue repo:paligo p:1 agent:claude area:docs {{task}}"],
    ["Inbox", "Inbox production workflow", "/issue repo:paligo p:1 agent:codex area:inbox {{task}}"],
    ["Exam", "สมุดข้อสอบ / workbook", "/issue repo:paligo p:1 agent:integrator area:exam {{task}}"],
    ["Human", "Decision needed", "/issue repo:paligo p:1 agent:human area:docs {{task}}"],
    ["P0", "Critical blocker", "/issue repo:paligo p:0 agent:integrator area:pipeline {{task}}"],
  ];
  const menuItems = [
    {
      title: "สร้าง issue",
      detail: "เริ่ม draft ทั่วไป",
      command: "/issue repo:paligo p:1 agent:codex area:pipeline ",
      tone: "primary",
    },
    {
      title: "P0 ด่วน",
      detail: "งานบล็อก launch",
      command: "/issue repo:paligo p:0 agent:integrator area:pipeline ",
      tone: "danger",
    },
    {
      title: "Inbox",
      detail: "chat, group, contact",
      command: "/issue repo:paligo p:1 agent:codex area:inbox ",
      tone: "normal",
    },
    {
      title: "UX/UI",
      detail: "Tailwind, mobile, HIG",
      command: "/issue repo:paligo p:1 agent:cursor area:inbox ",
      tone: "normal",
    },
    {
      title: "API/Worker",
      detail: "webhook, storage, route",
      command: "/issue repo:paligo p:1 agent:codex area:pipeline ",
      tone: "normal",
    },
    {
      title: "บาลี/เนื้อหา",
      detail: "PRD, copy, lesson",
      command: "/issue repo:paligo p:1 agent:claude area:docs ",
      tone: "normal",
    },
    {
      title: "Draft ล่าสุด",
      detail: "เปิด card ที่ค้าง",
      command: "draft",
      tone: "utility",
    },
    {
      title: "Issue ล่าสุด",
      detail: "ดูงานที่สร้างแล้ว",
      command: "issues",
      tone: "utility",
    },
  ];
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>LINE Issue Bot</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1f2d89;
      --muted: #707070;
      --line: #d9ddf1;
      --paper: #fffaf0;
      --surface: #ffffff;
      --ok: #06c755;
      --danger: #c2410c;
      --soft: #f8f9ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Noto Sans Thai", "Segoe UI", sans-serif;
      background: var(--paper);
      color: #202124;
    }
    body.is-locked button,
    body.is-locked textarea,
    body.is-locked input,
    body.is-locked a.action {
      opacity: .5;
      pointer-events: none;
    }
    body.is-locked .auth-notice { display: block; }
    main {
      width: min(720px, 100%);
      margin: 0 auto;
      padding: max(18px, env(safe-area-inset-top)) 18px max(24px, env(safe-area-inset-bottom));
    }
    header { margin: 8px 0 18px; }
    h1 {
      margin: 0;
      color: var(--ink);
      font-size: 1.45rem;
      line-height: 1.18;
      letter-spacing: 0;
    }
    .sub {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: .95rem;
      line-height: 1.45;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 5px 10px;
      background: rgba(255, 255, 255, .72);
      color: var(--ink);
      font-size: .82rem;
      font-weight: 800;
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 10px 30px rgba(31, 45, 137, .08);
    }
    .panel + .panel { margin-top: 14px; }
    .auth-notice {
      display: none;
      margin-bottom: 14px;
      border: 1px solid #fecaca;
      border-radius: 14px;
      padding: 12px;
      background: #fff7f7;
      color: #991b1b;
      font-size: .9rem;
      line-height: 1.45;
      font-weight: 800;
    }
    .section-title {
      margin: 0 0 10px;
      color: var(--ink);
      font-size: 1rem;
      line-height: 1.3;
      font-weight: 900;
    }
    .workflow {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .workflow-step, .role-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      padding: 11px;
    }
    .workflow-step {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 10px;
      align-items: start;
    }
    .step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      font-weight: 900;
    }
    .step-name, .role-name {
      display: block;
      color: #202124;
      font-weight: 900;
      line-height: 1.25;
    }
    .step-detail, .role-detail {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: .83rem;
      line-height: 1.4;
    }
    .roles-grid, .template-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 9px;
    }
    .template-grid { margin-top: 10px; }
    .role-tag {
      display: inline-flex;
      margin-top: 8px;
      border-radius: 999px;
      padding: 4px 8px;
      background: var(--soft);
      color: var(--ink);
      font-size: .78rem;
      font-weight: 900;
    }
    .task-input {
      width: 100%;
      min-height: 48px;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 11px 12px;
      font: 1rem/1.45 inherit;
      color: #202124;
      background: #fff;
      outline: none;
    }
    .task-input:focus {
      border-color: var(--ink);
      box-shadow: 0 0 0 3px rgba(31, 45, 137, .14);
    }
    .template-button {
      min-height: 74px;
      text-align: left;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 11px;
      background: #fff;
      color: #202124;
      font: inherit;
      cursor: pointer;
    }
    .template-button:first-child {
      border-color: var(--ink);
      background: var(--soft);
    }
    .template-button.is-selected {
      border-color: var(--ink);
      box-shadow: 0 0 0 3px rgba(31, 45, 137, .12);
    }
    .menu-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .menu-button {
      min-height: 86px;
      text-align: left;
      border: 1px solid var(--line);
      background: var(--soft);
      color: #202124;
      border-radius: 16px;
      padding: 12px;
      font: inherit;
      cursor: pointer;
    }
    .menu-button[data-tone="primary"] {
      border-color: var(--ink);
      background: var(--ink);
      color: #fff;
    }
    .menu-button[data-tone="danger"] {
      border-color: var(--danger);
      background: #fff7ed;
      color: var(--danger);
    }
    .menu-button[data-tone="utility"] {
      background: #fff;
      color: var(--ink);
    }
    .menu-title {
      display: block;
      font-size: .98rem;
      font-weight: 900;
      line-height: 1.25;
    }
    .menu-detail {
      display: block;
      margin-top: 5px;
      font-size: .8rem;
      line-height: 1.35;
      opacity: .78;
    }
    .preset {
      width: 100%;
      display: block;
      margin-top: 12px;
      text-align: left;
      border: 2px solid var(--ink);
      background: #f8f9ff;
      color: var(--ink);
      border-radius: 16px;
      padding: 14px;
      font: inherit;
      cursor: pointer;
    }
    .preset strong {
      display: block;
      font-size: 1rem;
      line-height: 1.35;
      margin-bottom: 6px;
    }
    .preset code {
      display: block;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: #343434;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .86rem;
      line-height: 1.5;
    }
    label {
      display: block;
      margin: 16px 0 8px;
      color: var(--muted);
      font-weight: 700;
    }
    textarea {
      width: 100%;
      min-height: 132px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 12px;
      font: 1rem/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans Thai", monospace;
      color: #202124;
      background: #fff;
      outline: none;
    }
    textarea:focus {
      border-color: var(--ink);
      box-shadow: 0 0 0 3px rgba(31, 45, 137, .14);
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin-top: 14px;
    }
    button.action, a.action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px 14px;
      text-decoration: none;
      font: 800 1rem/1.25 inherit;
      cursor: pointer;
    }
    .primary {
      border-color: var(--ok);
      background: var(--ok);
      color: #fff;
    }
    .secondary {
      background: #fff;
      color: var(--ink);
    }
    .status {
      min-height: 24px;
      margin: 12px 0 0;
      color: var(--muted);
      font-size: .9rem;
      line-height: 1.4;
    }
    @media (min-width: 560px) {
      .menu-grid { grid-template-columns: repeat(4, 1fr); }
      .workflow { grid-template-columns: repeat(4, 1fr); }
      .roles-grid { grid-template-columns: repeat(2, 1fr); }
      .template-grid { grid-template-columns: repeat(2, 1fr); }
      .actions { grid-template-columns: 1fr 1fr; }
      .actions .primary { grid-column: span 2; }
    }
    @media (max-width: 360px) {
      .menu-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>LINE Issue Bot</h1>
      <p class="sub">เลือกเมนูที่ใช้บ่อย แล้วส่งเข้าแชต LINE เพื่อให้ webhook สร้าง draft, เปิด status, หรือจัด route งานต่อ</p>
      <div class="meta">
        ${repoAliases.map((alias) => `<span class="pill">repo:${escapeHtml(alias)}</span>`).join("")}
      </div>
    </header>

    <section class="panel">
      <h2 class="section-title">Workflow process</h2>
      <div class="workflow">
        ${workflowSteps
          .map(
            ([number, name, detail]) => `<div class="workflow-step">
          <span class="step-number">${escapeHtml(number)}</span>
          <span>
            <span class="step-name">${escapeHtml(name)}</span>
            <span class="step-detail">${escapeHtml(detail)}</span>
          </span>
        </div>`
          )
          .join("")}
      </div>
    </section>

    <section class="panel">
      <h2 class="section-title">AI roles</h2>
      <div class="roles-grid">
        ${agentRoles
          .map(
            ([name, tag, detail]) => `<div class="role-card">
          <span class="role-name">${escapeHtml(name)}</span>
          <span class="role-detail">${escapeHtml(detail)}</span>
          <span class="role-tag">${escapeHtml(tag)}</span>
        </div>`
          )
          .join("")}
      </div>
    </section>

    <section class="panel">
      <div class="auth-notice" data-auth-notice>บัญชี LINE นี้ยังไม่ได้รับสิทธิ์ใช้ LIFF console</div>
      <h2 class="section-title">Quick commands</h2>
      <div class="menu-grid" aria-label="Issue bot menu">
        ${menuItems
          .map(
            (item) => `<button class="menu-button" type="button" data-command="${escapeAttr(item.command)}" data-tone="${escapeAttr(item.tone)}">
          <span class="menu-title">${escapeHtml(item.title)}</span>
          <span class="menu-detail">${escapeHtml(item.detail)}</span>
        </button>`
          )
          .join("")}
      </div>

      <label for="task-prompt">โจทย์ที่จะให้ AI ทำงาน</label>
      <input class="task-input" id="task-prompt" type="text" placeholder="พิมพ์โจทย์ เช่น ทำ inbox ให้รองรับกลุ่มและส่งไฟล์รูป" />

      <div class="template-grid" aria-label="AI command templates">
        ${commandTemplates
          .map(
            ([name, detail, template]) => `<button class="template-button" type="button" data-template="${escapeAttr(template)}">
          <span class="menu-title">${escapeHtml(name)}</span>
          <span class="menu-detail">${escapeHtml(detail)}</span>
        </button>`
          )
          .join("")}
      </div>

      <label for="issue-command">คำสั่งที่จะส่ง</label>
      <textarea id="issue-command" spellcheck="false">${escapeHtml(command)}</textarea>

      <button class="preset" type="button" data-command="${escapeAttr(command)}">
        <strong>Inbox refactor / compatibility route</strong>
        <code>${escapeHtml(command)}</code>
      </button>

      <div class="actions">
        <button class="action primary" type="button" data-send>ส่งเข้า LINE chat</button>
        <button class="action secondary" type="button" data-copy>คัดลอกคำสั่ง</button>
        <a class="action secondary" href="${escapeAttr(buildLineMessageUrl(oaId, command))}" data-open-line>เปิด LINE</a>
      </div>
      <p class="status" data-status>พร้อมเลือกคำสั่ง</p>
    </section>
  </main>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <script>
    const liffId = ${JSON.stringify(liffId)};
    const oaId = ${JSON.stringify(oaId)};
    const allowedUserIds = ${JSON.stringify(allowedUserIds || [])};
    const liffRequiresAuth = ${JSON.stringify(liffRequiresAuth)};
    const textarea = document.querySelector("#issue-command");
    const taskInput = document.querySelector("#task-prompt");
    const statusEl = document.querySelector("[data-status]");
    const openLineEl = document.querySelector("[data-open-line]");
    let liffAuthorized = !liffRequiresAuth;

    function setStatus(message) {
      statusEl.textContent = message;
    }

    function setUiLocked(locked, message) {
      document.body.classList.toggle("is-locked", locked);
      document.querySelectorAll("button, textarea, input").forEach((element) => {
        element.disabled = locked;
      });
      if (openLineEl) {
        openLineEl.setAttribute("aria-disabled", locked ? "true" : "false");
        openLineEl.tabIndex = locked ? -1 : 0;
      }
      if (message) setStatus(message);
    }

    function isAllowedUser(userId) {
      return !liffRequiresAuth || allowedUserIds.includes(userId);
    }

    function lineUrl(text) {
      if (!oaId) return "https://line.me/R/";
      return "https://line.me/R/oaMessage/" + encodeURIComponent(oaId) + "/?" + encodeURIComponent(text);
    }

    function syncOpenLine() {
      openLineEl.href = lineUrl(textarea.value.trim());
    }

    function taskText() {
      return (taskInput?.value || "").trim() || "รายละเอียดงาน";
    }

    function commandFromTemplate(template) {
      return String(template || "").replaceAll("{{task}}", taskText()).replace(/\\s+/g, " ").trim();
    }

    document.querySelectorAll("[data-command]").forEach((button) => {
      button.addEventListener("click", (event) => {
        textarea.value = event.currentTarget.dataset.command || "";
        textarea.focus();
        syncOpenLine();
        setStatus("เลือกเมนูแล้ว");
      });
    });

    document.querySelectorAll("[data-template]").forEach((button) => {
      button.addEventListener("click", (event) => {
        document.querySelectorAll("[data-template]").forEach((item) => item.classList.remove("is-selected"));
        event.currentTarget.classList.add("is-selected");
        textarea.value = commandFromTemplate(event.currentTarget.dataset.template);
        syncOpenLine();
        setStatus("สร้างคำสั่งจาก template แล้ว");
      });
    });

    taskInput?.addEventListener("input", () => {
      const selected = document.querySelector("[data-template].is-selected");
      if (selected) {
        textarea.value = commandFromTemplate(selected.dataset.template);
        syncOpenLine();
      }
    });

    textarea.addEventListener("input", syncOpenLine);

    document.querySelector("[data-copy]").addEventListener("click", async () => {
      if (!liffAuthorized) return setStatus("บัญชีนี้ยังไม่ได้รับสิทธิ์");
      const text = textarea.value.trim();
      if (!text) return setStatus("ยังไม่มีคำสั่ง");
      try {
        await navigator.clipboard.writeText(text);
        setStatus("คัดลอกแล้ว");
      } catch {
        textarea.focus();
        textarea.select();
        setStatus("คัดลอกอัตโนมัติไม่ได้ เลือกข้อความไว้ให้แล้ว");
      }
    });

    document.querySelector("[data-send]").addEventListener("click", async () => {
      if (!liffAuthorized) return setStatus("บัญชีนี้ยังไม่ได้รับสิทธิ์");
      const text = textarea.value.trim();
      if (!text) return setStatus("ยังไม่มีคำสั่ง");
      if (!window.liff || !liffId) return setStatus("LIFF ID ยังไม่พร้อม ใช้ปุ่มคัดลอกหรือเปิด LINE แทน");
      try {
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        await liff.sendMessages([{ type: "text", text }]);
        setStatus("ส่งเข้า LINE chat แล้ว");
        if (liff.isInClient()) setTimeout(() => liff.closeWindow(), 450);
      } catch (error) {
        setStatus(error.message || "ส่งไม่สำเร็จ");
      }
    });

    (async function init() {
      syncOpenLine();
      if (liffRequiresAuth) setUiLocked(true, "กำลังตรวจสิทธิ์ LINE userId");
      if (!window.liff || !liffId) {
        liffAuthorized = !liffRequiresAuth;
        setUiLocked(liffRequiresAuth, liffRequiresAuth ? "ต้องเปิดผ่าน LIFF เพื่อตรวจสิทธิ์ userId" : "เปิดแบบ browser ได้ แต่ยังไม่พบ LIFF ID");
        return;
      }
      try {
        await liff.init({ liffId });
        if (liffRequiresAuth) {
          if (!allowedUserIds.length) {
            liffAuthorized = false;
            setUiLocked(true, "LIFF allowlist ยังไม่มี userId ที่พร้อมใช้งาน");
            return;
          }
          if (!liff.isLoggedIn()) {
            setStatus("กำลังเข้าสู่ระบบ LINE เพื่อตรวจสิทธิ์");
            liff.login();
            return;
          }
          const profile = await liff.getProfile();
          liffAuthorized = isAllowedUser(profile.userId);
          setUiLocked(!liffAuthorized, liffAuthorized ? "ตรวจสิทธิ์ผ่าน: พร้อมส่งคำสั่ง" : "บัญชี LINE นี้ยังไม่ได้รับสิทธิ์ใช้ LIFF console");
          return;
        }
        liffAuthorized = true;
        setUiLocked(false, liff.isInClient() ? "เปิดใน LINE พร้อมส่ง" : "เปิดนอก LINE: ส่งได้หลัง login หรือใช้คัดลอก");
      } catch (error) {
        liffAuthorized = !liffRequiresAuth;
        setUiLocked(liffRequiresAuth, error.message || "LIFF init ไม่สำเร็จ");
      }
    })();
  </script>
</body>
</html>`;
}

function buildLineMessageUrl(oaId, command) {
  if (!oaId) return "https://line.me/R/";
  return `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(command)}`;
}

function readAllowedUserIds(env) {
  const raw = String(env.LINE_ALLOWED_USER_IDS || "").trim();
  if (!raw) return null;
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((value) => String(value).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
