/**
 * LINE Issue Bot core.
 *
 * Portable by design: no Paligo-specific imports, no D1 binding, no global
 * request state. Cloudflare Workers and other runtimes can wrap this module.
 */

const DEFAULT_REPO_ALIAS = "paligo";
const DEFAULT_REPOS = {
  paligo: {
    repo: "niyata/paligo-audio-learn",
    board: "https://github.com/users/niyata/projects/14",
  },
};
const DRAFT_TTL_SECONDS = 60 * 60 * 24 * 7;
const USER_ISSUES_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_USER_ISSUES = 8;

const KNOWN_LABELS = new Set([
  "agent:human",
  "agent:integrator",
  "agent:cursor-ai",
  "agent:codex-ai",
  "agent:other-ai",
  "priority:P0",
  "priority:P1",
  "priority:P2",
  "area:exam",
  "area:audio",
  "area:nav",
  "area:docs",
  "area:pipeline",
  "area:inbox",
]);

export async function handleLineIssueWebhook(request, env) {
  if (request.method.toUpperCase() !== "POST") {
    return errorResponse("method_not_allowed", "ใช้ POST เท่านั้น", 405);
  }

  const bodyText = await request.text();
  const signatureCheck = await verifyLineSignatureIfConfigured(request, env, bodyText);
  if (signatureCheck.error) return signatureCheck.error;

  let payload;
  try {
    payload = bodyText.trim() ? JSON.parse(bodyText) : {};
  } catch {
    return errorResponse("invalid_json", "LINE webhook JSON ไม่ถูกต้อง", 400);
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  const results = [];
  for (const event of events) {
    try {
      const result = await handleLineEvent(event, env);
      results.push(result);
    } catch (error) {
      await replyLine(env, event?.replyToken, [
        {
          type: "text",
          text: formatUserFacingError(error),
        },
      ]);
      results.push({ type: event?.type || "unknown", status: "error", message: error.message || "unknown" });
    }
  }

  return jsonResponse({ ok: true, handled: results.length, results });
}

export function parseIssueCommand(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const normalized = raw.replace(/\s+/g, " ");
  const createIntent = /^\/issue\s+create\b/i.test(normalized) || /\s--yes\b/i.test(normalized);
  const previewIntent =
    /^\/issue\b/i.test(normalized) ||
    /^issue\b/i.test(normalized) ||
    /^สร้าง\s*issue\b/i.test(normalized) ||
    /^เปิด\s*issue\b/i.test(normalized);

  if (!previewIntent) return null;

  let body = normalized
    .replace(/^\/issue\s+create\b/i, "")
    .replace(/^\/issue\b/i, "")
    .replace(/^issue\b/i, "")
    .replace(/^สร้าง\s*issue\b/i, "")
    .replace(/^เปิด\s*issue\b/i, "")
    .replace(/\s--yes\b/i, "")
    .trim();

  const repoMatch = body.match(/(?:^|\s)(?:repo|repository):([a-z0-9_.-]+)/i);
  const priorityMatch = body.match(/(?:^|\s)(?:p|priority):([0-2])/i);
  const agentMatch = body.match(/(?:^|\s)(?:agent):([a-z0-9_-]+)/i);
  const areaMatch = body.match(/(?:^|\s)(?:area):([a-z0-9_-]+)/i);

  body = body
    .replace(/(?:^|\s)(?:repo|repository):[a-z0-9_.-]+/gi, " ")
    .replace(/(?:^|\s)(?:p|priority):[0-2]/gi, " ")
    .replace(/(?:^|\s)(?:agent):[a-z0-9_-]+/gi, " ")
    .replace(/(?:^|\s)(?:area):[a-z0-9_-]+/gi, " ")
    .trim();

  return {
    action: createIntent ? "create" : "preview",
    text: body || normalized,
    repoAlias: repoMatch?.[1]?.toLowerCase() || DEFAULT_REPO_ALIAS,
    forcedPriority: priorityMatch ? `priority:P${priorityMatch[1]}` : "",
    forcedAgent: normalizeAgentLabel(agentMatch?.[1] || ""),
    forcedArea: normalizeAreaLabel(areaMatch?.[1] || ""),
  };
}

export function buildIssueDraft(command, source = {}) {
  const text = command.text.slice(0, 1800);
  const title = buildTitle(text);
  const priority = command.forcedPriority || classifyPriority(text);
  const agent = command.forcedAgent || classifyAgent(text);
  const area = command.forcedArea || classifyArea(text);
  const labels = [priority, agent, area].filter((label) => KNOWN_LABELS.has(label));
  const attachments = Array.isArray(source.attachments) ? source.attachments : [];
  const attachmentLines = attachments.flatMap((attachment, index) => [
    `### Attachment ${index + 1}`,
    "",
    attachment.url ? `![LINE attachment ${index + 1}](${attachment.url})` : "",
    attachment.url ? `[Open attachment](${attachment.url})` : "",
    "",
  ]);

  return {
    id: source.draftId || "",
    repoAlias: command.repoAlias,
    title,
    labels,
    text,
    priority,
    agent,
    area,
    attachments,
    body: [
      "## User request",
      "",
      text,
      "",
      attachments.length ? "## Attachments" : "",
      "",
      ...attachmentLines,
      "## Triage",
      "",
      `- Source: LINE issue bot`,
      `- Suggested owner: \`${agent}\``,
      `- Priority: \`${priority}\``,
      `- Area: \`${area}\``,
      source.userId ? `- LINE userId: \`${source.userId}\`` : "",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] Clarify expected behavior with PO if needed",
      "- [ ] Implement the smallest safe slice",
      "- [ ] Run relevant checks and record the test plan",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function handleLineEvent(event, env) {
  if (isWhoamiEvent(event)) {
    await replyLine(env, event.replyToken, [buildWhoamiMessage(event)]);
    return { type: event?.type || "message", status: "whoami", userId: event.source?.userId || "" };
  }

  const authorization = authorizeLineUser(event, env);
  if (!authorization.allowed) {
    await replyLine(env, event?.replyToken, [buildUnauthorizedMessage(event)]);
    return {
      type: event?.type || "unknown",
      status: "unauthorized",
      userId: event?.source?.userId || "",
    };
  }

  if (event?.type === "postback") {
    return handlePostbackEvent(event, env);
  }

  if (event?.type !== "message") {
    return { type: event?.type || "unknown", status: "ignored" };
  }

  if (event.message?.type === "image") {
    return handleImageMessageEvent(event, env);
  }

  if (event.message?.type !== "text") {
    return { type: event.message?.type || "unknown", status: "ignored_message" };
  }

  const utility = await handleUtilityTextEvent(event, env);
  if (utility) return utility;

  const command = parseIssueCommand(event.message.text);
  if (!command) {
    const updatedDraft = await updateLatestImageDraftWithText(event, env);
    if (updatedDraft) {
      await replyLine(env, event.replyToken, [buildDraftFlexMessage(updatedDraft, readRepoConfig(env)[updatedDraft.repoAlias])]);
      return { type: "message", status: "draft_text_updated", draftId: updatedDraft.id };
    }
    await replyLine(env, event.replyToken, [
      {
        type: "text",
        text: "พิมพ์ /issue รายละเอียดงาน เพื่อให้ผมช่วยจัดหมวดและเตรียม issue ให้ครับ",
      },
    ]);
    return { type: "message", status: "help" };
  }

  const repos = readRepoConfig(env);
  const repoInfo = repos[command.repoAlias];
  if (!repoInfo?.repo) {
    await replyLine(env, event.replyToken, [
      { type: "text", text: `ไม่พบ repo alias "${command.repoAlias}" ใน ISSUE_BOT_REPOS_JSON` },
    ]);
    return { type: "message", status: "unknown_repo", repoAlias: command.repoAlias };
  }

  const draftId = createDraftId();
  const draft = buildIssueDraft(command, {
    draftId,
    userId: event.source?.userId || "",
    attachments: await readLatestDraftAttachments(event.source?.userId || "", env),
  });
  if (command.action !== "create") {
    const draftStored = await saveDraft(env, draft, event.source?.userId || "");
    await replyLine(env, event.replyToken, [buildDraftFlexMessage(draft, repoInfo)]);
    return {
      type: "message",
      status: "preview",
      repo: repoInfo.repo,
      labels: draft.labels,
      draftId: draft.id,
      draftStored,
    };
  }

  if (!env.GITHUB_ISSUE_BOT_TOKEN) {
    await replyLine(env, event.replyToken, [
      {
        type: "text",
        text: "ยังไม่ได้ตั้ง GITHUB_ISSUE_BOT_TOKEN จึงสร้าง issue จริงไม่ได้ ตอนนี้ทำได้เฉพาะ preview",
      },
    ]);
    return { type: "message", status: "github_token_missing" };
  }

  const issue = await createGitHubIssue(env, repoInfo.repo, draft);
  await rememberCreatedIssue(env, event.source?.userId || "", issue, repoInfo.repo);
  await replyLine(env, event.replyToken, [
    {
      type: "text",
      text: `สร้าง issue แล้วครับ\n${issue.html_url}`,
    },
  ]);
  return { type: "message", status: "created", repo: repoInfo.repo, url: issue.html_url };
}

async function handleUtilityTextEvent(event, env) {
  const text = String(event.message?.text || "").trim().toLowerCase();
  const userId = event.source?.userId || "";
  if (["help", "/help", "ช่วย", "วิธีใช้"].includes(text)) {
    await replyLine(env, event.replyToken, [buildHelpMessage()]);
    return { type: "message", status: "help" };
  }
  if (["menu", "/menu", "เมนู"].includes(text)) {
    await replyLine(env, event.replyToken, [buildMenuFlexMessage()]);
    return { type: "message", status: "menu" };
  }
  if (["issues", "/issues", "status", "/status", "สถานะ"].includes(text)) {
    await replyLine(env, event.replyToken, [await buildLatestIssuesMessage(env, userId)]);
    return { type: "message", status: "issues" };
  }
  if (["repo", "repos", "project", "projects", "โปรเจ็ค", "โปรเจกต์"].includes(text)) {
    await replyLine(env, event.replyToken, [buildReposMessage(env)]);
    return { type: "message", status: "repos" };
  }
  if (["draft", "/draft", "preview", "/preview", "รายการล่าสุด"].includes(text)) {
    const draft = await getLatestDraftForUser(env, userId);
    if (!draft) {
      await replyLine(env, event.replyToken, [{ type: "text", text: "ยังไม่มี draft ที่รอยืนยันครับ" }]);
      return { type: "message", status: "draft_not_found" };
    }
    await replyLine(env, event.replyToken, [buildDraftFlexMessage(draft, readRepoConfig(env)[draft.repoAlias])]);
    return { type: "message", status: "draft_replayed", draftId: draft.id };
  }
  if (["cancel", "/cancel", "ยกเลิก"].includes(text)) {
    const draft = await getLatestDraftForUser(env, userId);
    if (draft) await markDraftStatus(env, draft, "cancelled");
    await replyLine(env, event.replyToken, [{ type: "text", text: "ยกเลิก draft ล่าสุดแล้วครับ" }]);
    return { type: "message", status: draft ? "cancelled" : "draft_not_found" };
  }
  return null;
}

async function handleImageMessageEvent(event, env) {
  const userId = event.source?.userId || "";
  const messageId = event.message?.id || "";
  if (!messageId) {
    return { type: "image", status: "missing_message_id" };
  }
  if (!env.LINE_ISSUE_ASSETS || !env.LINE_ISSUE_DRAFTS) {
    await replyLine(env, event.replyToken, [
      { type: "text", text: "ยังไม่ได้ตั้ง R2/KV สำหรับเก็บรูปและ draft" },
    ]);
    return { type: "image", status: "storage_unavailable" };
  }

  let draft = await getLatestDraftForUser(env, userId);
  if (!draft) {
    const command = {
      action: "preview",
      text: "LINE image attachment",
      repoAlias: DEFAULT_REPO_ALIAS,
      forcedPriority: "",
      forcedAgent: "",
      forcedArea: "area:inbox",
    };
    draft = buildIssueDraft(command, { draftId: createDraftId(), userId, attachments: [] });
  }

  const attachment = await fetchAndStoreLineImage(env, messageId, draft.id);
  const attachments = [...(draft.attachments || []), attachment];
  const nextDraft = rebuildDraftWithAttachments(draft, attachments, userId);
  const draftStored = await saveDraft(env, nextDraft, userId);
  await replyLine(env, event.replyToken, [buildDraftFlexMessage(nextDraft, readRepoConfig(env)[nextDraft.repoAlias])]);
  return {
    type: "image",
    status: "draft_image_added",
    draftId: nextDraft.id,
    draftStored,
    attachment: attachment.url,
  };
}

async function handlePostbackEvent(event, env) {
  const data = String(event.postback?.data || "");
  if (data.startsWith("confirm_issue:")) {
    const draftId = data.slice("confirm_issue:".length);
    const draft = await getDraft(env, draftId);
    if (!draft) {
      await replyLine(env, event.replyToken, [{ type: "text", text: "draft หมดอายุหรือถูกลบแล้ว" }]);
      return { type: "postback", status: "draft_not_found", draftId };
    }
    const repoInfo = readRepoConfig(env)[draft.repoAlias];
    if (!repoInfo?.repo) {
      await replyLine(env, event.replyToken, [{ type: "text", text: "repo ของ draft นี้ไม่พร้อมใช้งาน" }]);
      return { type: "postback", status: "unknown_repo", draftId };
    }
    const issue = await createGitHubIssue(env, repoInfo.repo, draft);
    await rememberCreatedIssue(env, event.source?.userId || "", issue, repoInfo.repo);
    await markDraftStatus(env, draft, "created", { issueUrl: issue.html_url });
    await replyLine(env, event.replyToken, [
      {
        type: "text",
        text: `สร้าง issue แล้วครับ\n${issue.html_url}`,
      },
    ]);
    return { type: "postback", status: "created", draftId, url: issue.html_url };
  }

  if (data.startsWith("cancel_issue:")) {
    const draftId = data.slice("cancel_issue:".length);
    const draft = await getDraft(env, draftId);
    if (draft) await markDraftStatus(env, draft, "cancelled");
    await replyLine(env, event.replyToken, [{ type: "text", text: "ยกเลิก draft แล้วครับ" }]);
    return { type: "postback", status: "cancelled", draftId };
  }

  return { type: "postback", status: "ignored" };
}

async function updateLatestImageDraftWithText(event, env) {
  const userId = event.source?.userId || "";
  const latest = await getLatestDraftForUser(env, userId);
  if (!latest || !(latest.attachments || []).length) return null;
  const command = {
    action: "preview",
    text: event.message.text,
    repoAlias: latest.repoAlias || DEFAULT_REPO_ALIAS,
    forcedPriority: latest.priority || "",
    forcedAgent: latest.agent || "",
    forcedArea: latest.area || "",
  };
  const draft = buildIssueDraft(command, {
    draftId: latest.id,
    userId,
    attachments: latest.attachments || [],
  });
  await saveDraft(env, draft, userId);
  return draft;
}

async function readLatestDraftAttachments(userId, env) {
  const latest = await getLatestDraftForUser(env, userId);
  if (!latest || latest.status !== "pending") return [];
  return latest.attachments || [];
}

function buildPreviewReply(draft, repoInfo) {
  return {
    type: "text",
    text: [
      "Issue preview",
      `Repo: ${repoInfo.repo}`,
      `Title: ${draft.title}`,
      `Labels: ${draft.labels.join(", ") || "-"}`,
      "",
      "ถ้าจะสร้างจริง ให้ส่งใหม่ด้วย:",
      `/issue create ${draft.title} --yes`,
    ].join("\n"),
  };
}

function buildHelpMessage() {
  return {
    type: "text",
    text: [
      "LINE Issue Bot",
      "",
      "สร้าง draft:",
      "/issue repo:paligo p:1 agent:codex area:inbox รายละเอียดงาน",
      "",
      "เมนู:",
      "พิมพ์ menu เพื่อเปิดปุ่มลัด",
      "พิมพ์ issues เพื่อดู issue ล่าสุด",
      "",
      "เปลี่ยน repo/project:",
      "ใช้ repo:<alias> เช่น repo:paligo",
      "พิมพ์ repos เพื่อดู alias ที่เปิดไว้",
      "",
      "แนบรูป:",
      "ส่งรูป screenshot แล้วส่งข้อความอธิบายต่อ",
      "",
      "คำสั่ง:",
      "menu — เปิดเมนูปุ่มลัด",
      "issues — ดู issue ล่าสุด",
      "repos — ดู repo aliases",
      "whoami — ดู LINE userId ของตัวเอง",
      "draft — ดู draft ล่าสุด",
      "cancel — ยกเลิก draft ล่าสุด",
    ].join("\n"),
  };
}

function isWhoamiEvent(event) {
  const text = String(event?.message?.text || "").trim().toLowerCase();
  return event?.type === "message" && event?.message?.type === "text" && ["whoami", "/whoami", "user", "userid"].includes(text);
}

function buildWhoamiMessage(event) {
  const userId = event?.source?.userId || "-";
  const groupId = event?.source?.groupId || "";
  const roomId = event?.source?.roomId || "";
  return {
    type: "text",
    text: [
      "LINE identity",
      "",
      `userId: ${userId}`,
      groupId ? `groupId: ${groupId}` : "",
      roomId ? `roomId: ${roomId}` : "",
      "",
      "นำ userId ไปใส่ใน LINE_ALLOWED_USER_IDS เพื่อจำกัดสิทธิ์ bot",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildUnauthorizedMessage(event) {
  const userId = event?.source?.userId || "-";
  return {
    type: "text",
    text: [
      "บัญชี LINE นี้ยังไม่ได้รับสิทธิ์ใช้ Issue Bot",
      "",
      `userId: ${userId}`,
      "",
      "ถ้าต้องการเพิ่มสิทธิ์ ให้เพิ่ม userId นี้ใน LINE_ALLOWED_USER_IDS",
    ].join("\n"),
  };
}

function authorizeLineUser(event, env) {
  const allowedUserIds = readAllowedUserIds(env);
  if (allowedUserIds === null) return { allowed: true, mode: "open" };
  const userId = String(event?.source?.userId || "");
  return {
    allowed: Boolean(userId && allowedUserIds.includes(userId)),
    mode: "allowlist",
  };
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

function buildMenuFlexMessage() {
  const buttons = [
    ["สร้าง issue", "/issue repo:paligo p:1 agent:codex area:pipeline "],
    ["P0 ด่วน", "/issue repo:paligo p:0 agent:integrator area:pipeline "],
    ["Inbox", "/issue repo:paligo p:1 agent:codex area:inbox "],
    ["UX/UI", "/issue repo:paligo p:1 agent:cursor area:inbox "],
    ["API/Worker", "/issue repo:paligo p:1 agent:codex area:pipeline "],
    ["บาลี/เนื้อหา", "/issue repo:paligo p:1 agent:claude area:docs "],
    ["Draft ล่าสุด", "draft"],
    ["Issue ล่าสุด", "issues"],
  ];
  return {
    type: "flex",
    altText: "LINE Issue Bot menu",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "18px",
        contents: [
          { type: "text", text: "Issue Bot Menu", weight: "bold", size: "lg", color: "#1f2d89" },
          { type: "text", text: "เลือกงานที่ต้องการส่งเข้า workflow", size: "sm", color: "#707070", wrap: true },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: buttons.map(([label, text]) => ({
              type: "button",
              style: ["สร้าง issue", "P0 ด่วน"].includes(label) ? "primary" : "secondary",
              height: "sm",
              color: ["สร้าง issue", "P0 ด่วน"].includes(label) ? "#1f2d89" : undefined,
              action: { type: "message", label, text },
            })),
          },
        ],
      },
    },
  };
}

async function buildLatestIssuesMessage(env, userId) {
  const issues = await getLatestIssuesForUser(env, userId);
  if (!issues.length) {
    return {
      type: "text",
      text: "ยังไม่มี issue ที่ bot จำไว้สำหรับ user นี้ครับ",
    };
  }
  return {
    type: "text",
    text: [
      "Issue ล่าสุด",
      "",
      ...issues.map((issue, index) => {
        const repo = issue.repo ? `${issue.repo} ` : "";
        return `${index + 1}. ${repo}#${issue.number} ${issue.title}\n${issue.url}`;
      }),
    ].join("\n"),
  };
}

function buildReposMessage(env) {
  const repos = readRepoConfig(env);
  const lines = Object.entries(repos)
    .filter(([, info]) => info?.repo)
    .map(([alias, info]) => `${alias} -> ${info.repo}`);
  return {
    type: "text",
    text: [
      "Repo aliases",
      "",
      lines.length ? lines.join("\n") : "ยังไม่มี repo alias ที่พร้อมใช้งาน",
      "",
      "ใช้ในคำสั่ง:",
      "/issue repo:<alias> p:1 agent:codex area:inbox รายละเอียดงาน",
      "",
      "เพิ่มหรือเปลี่ยน alias ได้ใน ISSUE_BOT_REPOS_JSON",
    ].join("\n"),
  };
}

async function rememberCreatedIssue(env, userId, issue, repo) {
  if (!env.LINE_ISSUE_DRAFTS || !userId || !issue?.html_url) return;
  const issues = await getLatestIssuesForUser(env, userId);
  const next = [
    {
      repo,
      number: issue.number,
      title: issue.title || "GitHub issue",
      url: issue.html_url,
      createdAt: new Date().toISOString(),
    },
    ...issues.filter((item) => item.url !== issue.html_url),
  ].slice(0, MAX_USER_ISSUES);
  await env.LINE_ISSUE_DRAFTS.put(`user:${userId}:issues`, JSON.stringify(next), {
    expirationTtl: USER_ISSUES_TTL_SECONDS,
  });
}

async function getLatestIssuesForUser(env, userId) {
  if (!env.LINE_ISSUE_DRAFTS || !userId) return [];
  const text = await env.LINE_ISSUE_DRAFTS.get(`user:${userId}:issues`);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_USER_ISSUES) : [];
  } catch {
    return [];
  }
}

function buildDraftFlexMessage(draft, repoInfo) {
  const imageUrl = draft.attachments?.[0]?.url || "";
  const title = truncate(draft.title || "Issue draft", 72);
  const bodyText = truncate(draft.text || "LINE image attachment", 220);
  const labels = draft.labels?.join(" · ") || "-";
  const contents = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "18px",
      contents: [
        {
          type: "text",
          text: "Issue draft",
          size: "xs",
          color: "#707070",
          weight: "bold",
        },
        {
          type: "text",
          text: title,
          weight: "bold",
          size: "lg",
          color: "#1f2d89",
          wrap: true,
        },
        {
          type: "text",
          text: repoInfo?.repo || draft.repoAlias,
          size: "sm",
          color: "#707070",
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#fffaf0",
          cornerRadius: "12px",
          paddingAll: "12px",
          contents: [
            {
              type: "text",
              text: bodyText,
              size: "sm",
              color: "#202124",
              wrap: true,
            },
          ],
        },
        {
          type: "text",
          text: labels,
          size: "xs",
          color: "#707070",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: "#1f2d89",
          action: {
            type: "postback",
            label: "ยืนยันสร้าง issue",
            data: `confirm_issue:${draft.id}`,
            displayText: "ยืนยันสร้าง issue",
          },
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: "แก้ไขข้อความ",
                text: buildEditMessageText(draft),
              },
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "postback",
                label: "ยกเลิก",
                data: `cancel_issue:${draft.id}`,
                displayText: "ยกเลิก issue draft",
              },
            },
          ],
        },
      ],
    },
  };
  if (imageUrl) {
    contents.hero = {
      type: "image",
      url: imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    };
  }
  return {
    type: "flex",
    altText: `Issue draft: ${title}`,
    contents,
  };
}

function buildEditMessageText(draft) {
  const repo = draft.repoAlias || DEFAULT_REPO_ALIAS;
  const priority = (draft.priority || "").replace("priority:P", "p:");
  const agent = (draft.agent || "").replace("agent:", "agent:");
  const area = (draft.area || "").replace("area:", "area:");
  return `/issue repo:${repo} ${priority} ${agent} ${area} ${draft.text || draft.title || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

async function createGitHubIssue(env, repo, draft) {
  const payload = {
    title: draft.title,
    body: draft.body,
    labels: draft.labels,
  };
  let response = await postGitHubIssue(env, repo, payload);
  let data = await response.json().catch(() => ({}));
  if (!response.ok && shouldRetryWithoutLabels(response.status, data) && draft.labels?.length) {
    response = await postGitHubIssue(env, repo, {
      title: draft.title,
      body: `${draft.body}\n\n## Suggested labels\n\n${draft.labels.map((label) => `- \`${label}\``).join("\n")}`,
    });
    data = await response.json().catch(() => ({}));
  }
  if (!response.ok) {
    const message = data?.message || `GitHub API error ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function postGitHubIssue(env, repo, payload) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_ISSUE_BOT_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": env.ISSUE_BOT_USER_AGENT || "paligo-line-issue-bot",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(payload),
  });
  return response;
}

function shouldRetryWithoutLabels(status, data) {
  if (status !== 422) return false;
  const message = String(data?.message || "").toLowerCase();
  if (message.includes("label")) return true;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  return errors.some((error) => String(error?.field || "").toLowerCase().includes("label"));
}

function formatUserFacingError(error) {
  const message = String(error?.message || "unknown error");
  if (message.toLowerCase().includes("resource not accessible by personal access token")) {
    return [
      "สร้าง issue ไม่สำเร็จ: GitHub token ไม่มีสิทธิ์สร้าง issue ใน repo นี้",
      "",
      "ให้ตั้ง Fine-grained PAT ที่เลือก repo ปลายทาง และเปิด Permission: Issues = Read and write",
    ].join("\n");
  }
  if (message.toLowerCase().includes("bad credentials")) {
    return "สร้าง issue ไม่สำเร็จ: GitHub token ไม่ถูกต้องหรือหมดอายุ";
  }
  return `สร้าง issue ไม่สำเร็จ: ${message}`;
}

async function fetchAndStoreLineImage(env, messageId, draftId) {
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE image download failed: ${response.status} ${text.slice(0, 160)}`);
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const bytes = await response.arrayBuffer();
  const extension = extensionForContentType(contentType);
  const key = `issue-drafts/${draftId}/${messageId}.${extension}`;
  await env.LINE_ISSUE_ASSETS.put(key, bytes, {
    httpMetadata: { contentType },
  });
  return {
    kind: "image",
    key,
    url: `${publicOrigin(env)}/assets/${encodeURIComponent(key)}`,
    contentType,
    size: bytes.byteLength,
    messageId,
  };
}

function rebuildDraftWithAttachments(draft, attachments, userId) {
  const command = {
    action: "preview",
    text: draft.text || "LINE image attachment",
    repoAlias: draft.repoAlias || DEFAULT_REPO_ALIAS,
    forcedPriority: draft.priority || "",
    forcedAgent: draft.agent || "",
    forcedArea: draft.area || "",
  };
  return buildIssueDraft(command, {
    draftId: draft.id || createDraftId(),
    userId,
    attachments,
  });
}

async function saveDraft(env, draft, userId) {
  if (!env.LINE_ISSUE_DRAFTS || !draft?.id) return false;
  const payload = {
    ...draft,
    status: draft.status || "pending",
    updatedAt: new Date().toISOString(),
    createdAt: draft.createdAt || new Date().toISOString(),
  };
  await env.LINE_ISSUE_DRAFTS.put(`draft:${draft.id}`, JSON.stringify(payload), {
    expirationTtl: DRAFT_TTL_SECONDS,
  });
  if (userId) {
    await env.LINE_ISSUE_DRAFTS.put(`user:${userId}:latestDraft`, draft.id, {
      expirationTtl: DRAFT_TTL_SECONDS,
    });
  }
  return true;
}

async function getDraft(env, draftId) {
  if (!env.LINE_ISSUE_DRAFTS || !draftId) return null;
  const text = await env.LINE_ISSUE_DRAFTS.get(`draft:${draftId}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getLatestDraftForUser(env, userId) {
  if (!env.LINE_ISSUE_DRAFTS || !userId) return null;
  const draftId = await env.LINE_ISSUE_DRAFTS.get(`user:${userId}:latestDraft`);
  if (!draftId) return null;
  const draft = await getDraft(env, draftId);
  if (!draft || draft.status !== "pending") return null;
  return draft;
}

async function markDraftStatus(env, draft, status, extra = {}) {
  if (!env.LINE_ISSUE_DRAFTS || !draft?.id) return;
  await env.LINE_ISSUE_DRAFTS.put(
    `draft:${draft.id}`,
    JSON.stringify({ ...draft, ...extra, status, updatedAt: new Date().toISOString() }),
    { expirationTtl: DRAFT_TTL_SECONDS }
  );
}

async function verifyLineSignatureIfConfigured(request, env, bodyText) {
  const secret = String(env.LINE_CHANNEL_SECRET || "");
  if (!secret) {
    const hostname = new URL(request.url).hostname;
    const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isLocalDev) {
      return {
        error: errorResponse(
          "line_secret_missing",
          "ต้องตั้ง LINE_CHANNEL_SECRET ก่อนเปิด production webhook",
          503
        ),
      };
    }
    return { ok: true };
  }

  const expected = request.headers.get("x-line-signature") || "";
  const actual = await signLineBody(secret, bodyText);
  if (!timingSafeStringEqual(expected, actual)) {
    return { error: errorResponse("invalid_line_signature", "LINE signature ไม่ถูกต้อง", 401) };
  }
  return { ok: true };
}

async function signLineBody(secret, bodyText) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  return bytesToBase64(new Uint8Array(signature));
}

async function replyLine(env, replyToken, messages) {
  const channelToken = String(env.LINE_CHANNEL_ACCESS_TOKEN || "");
  if (!channelToken || !replyToken) return { skipped: true };

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE reply failed: ${response.status} ${text.slice(0, 240)}`);
  }
  return { ok: true };
}

function readRepoConfig(env) {
  const raw = String(env.ISSUE_BOT_REPOS_JSON || "").trim();
  if (!raw) return DEFAULT_REPOS;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : DEFAULT_REPOS;
  } catch {
    return DEFAULT_REPOS;
  }
}

function createDraftId() {
  return crypto.randomUUID();
}

function publicOrigin(env) {
  return String(env.ISSUE_BOT_PUBLIC_ORIGIN || "https://chat.paligo.jp").replace(/\/+$/, "");
}

function extensionForContentType(contentType) {
  const value = String(contentType || "").toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  if (value.includes("gif")) return "gif";
  return "jpg";
}

function truncate(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function buildTitle(text) {
  const firstLine = String(text || "")
    .split(/\n+/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!firstLine) return "Triage request from LINE";
  return firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
}

function classifyPriority(text) {
  const t = text.toLowerCase();
  if (/(launch|blocker|production|prod|critical|พัง|เปิดตัว|ล่ม|ใช้ไม่ได้|บล็อก)/i.test(t)) {
    return "priority:P0";
  }
  if (/(mvp|inbox|worker|api|ต้องทำ|เร็ว|sprint|production grade)/i.test(t)) {
    return "priority:P1";
  }
  return "priority:P2";
}

function classifyAgent(text) {
  const t = text.toLowerCase();
  if (/(dirty tree|migration|rename|refactor|compatibility|release|launch|หลาย agent|ข้าม agent|เคลม|ค้าง)/i.test(t)) {
    return "agent:integrator";
  }
  if (/(ui|ux|tailwind|css|layout|responsive|mobile|font|modal|figma|apple hig|หน้าจอ|ดีไซน์)/i.test(t)) {
    return "agent:cursor-ai";
  }
  if (/(api|worker|webhook|database|d1|auth|logic|test|route|github|line chatbot|chatbot)/i.test(t)) {
    return "agent:codex-ai";
  }
  if (/(prd|spec|copy|บาลี|lesson|ตำรา|เนื้อหา|prompt|requirements)/i.test(t)) {
    return "agent:other-ai";
  }
  if (/(ตัดสินใจ|approve|อนุมัติ|policy|ราคา|จ่าย|เลือก)/i.test(t)) {
    return "agent:human";
  }
  return "agent:codex-ai";
}

function classifyArea(text) {
  const t = text.toLowerCase();
  if (/(inbox|chat|message|group|contact|line)/i.test(t)) return "area:inbox";
  if (/(exam|ข้อสอบ|แบบฝึกหัด|สมุด|review|ตรวจ)/i.test(t)) return "area:exam";
  if (/(audio|เสียง|pdf|highlight|hightlight)/i.test(t)) return "area:audio";
  if (/(nav|sidebar|menu|shell|routing)/i.test(t)) return "area:nav";
  if (/(docs|prd|spec|workflow|scrum|issue)/i.test(t)) return "area:docs";
  return "area:pipeline";
}

function normalizeAgentLabel(value) {
  const key = String(value || "").toLowerCase();
  if (!key) return "";
  if (key.startsWith("agent:")) return key;
  if (key === "cursor") return "agent:cursor-ai";
  if (key === "codex") return "agent:codex-ai";
  if (key === "claude" || key === "other") return "agent:other-ai";
  if (key === "integrator") return "agent:integrator";
  if (key === "human" || key === "po") return "agent:human";
  return "";
}

function normalizeAreaLabel(value) {
  const key = String(value || "").toLowerCase();
  if (!key) return "";
  if (key.startsWith("area:")) return key;
  if (key === "workbook" || key === "book") return "area:exam";
  if (["inbox", "exam", "audio", "nav", "docs", "pipeline"].includes(key)) return `area:${key}`;
  return "";
}

function timingSafeStringEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(code, message, status) {
  return jsonResponse({ error: code, message }, status);
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
