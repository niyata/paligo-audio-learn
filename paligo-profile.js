/**
 * Paligo user profile — local fields + Inbox account sync
 */
(function (global) {
  const ROLE_LABELS = {
    student: "นักเรียน",
    reviewer: "ครู/ผู้ตรวจ",
  };

  const PREFIX_OPTIONS = ["กัลฯ", "สามเณร", "พระ", "พระมหา", "อุบาสิกา", "อุบาสก"];

  const GRADE_OPTIONS = [
    { value: "1-2", label: "๑-๒" },
    { value: "3", label: "๓" },
    { value: "4", label: "๔" },
    { value: "5", label: "๕" },
    { value: "6", label: "๖" },
    { value: "7", label: "๗" },
    { value: "8", label: "๘" },
    { value: "9", label: "๙" },
  ];

  const DELIVERY_OPTIONS = [
    { value: "line", label: "LINE / กล่องข้อความ" },
    { value: "email", label: "อีเมล" },
    { value: "facebook", label: "Facebook" },
  ];

  const REVIEWER_PROFILE_STATUS_OPTIONS = [
    { value: "monk_teacher", label: "พระอาจารย์" },
    { value: "novice_teacher", label: "สามเณรอาจารย์" },
    { value: "lay_teacher", label: "อาจารย์ฆราวาส" },
    { value: "teaching_assistant", label: "ผู้ช่วยสอน" },
    { value: "reviewer", label: "ผู้ตรวจ" },
  ];

  const REVIEWER_CAPABILITY_OPTIONS = [
    { value: "teach", label: "ครูผู้สอน" },
    { value: "review", label: "ผู้ตรวจ" },
    { value: "teach_review", label: "ครูผู้สอนและผู้ตรวจ" },
  ];

  const REVIEWER_CAPABILITY_WIZARD_OPTIONS = [
    { value: "teach", label: "สอน" },
    { value: "review", label: "ตรวจสมุด" },
    { value: "teach_review", label: "สอนและตรวจสมุด" },
  ];

  const REGISTER_ROLE_OPTIONS = [
    { value: "student", label: "นักเรียน", helper: "ทำสมุดข้อสอบและส่งตรวจ" },
    { value: "reviewer", label: "ครูหรือผู้ตรวจ", helper: "รับตรวจสมุดหรือดูแลนักเรียน" },
  ];

  const PROFILE_STATUS_LABELS = Object.fromEntries(
    REVIEWER_PROFILE_STATUS_OPTIONS.map((item) => [item.value, item.label])
  );

  const CAPABILITY_LABELS = Object.fromEntries(
    REVIEWER_CAPABILITY_OPTIONS.map((item) => [item.value, item.label])
  );

  const CAPABILITY_SHORT_LABELS = {
    teach: "สอน",
    review: "ตรวจ",
    teach_review: "สอน·ตรวจ",
  };

  const REVIEW_AVAILABILITY_STATUS_OPTIONS = [
    { value: "open", label: "พร้อมรับตรวจ" },
    { value: "limited", label: "รับได้จำกัด" },
    { value: "full", label: "คิวเต็ม" },
    { value: "closed", label: "ยังไม่พร้อมตรวจ" },
  ];

  const REVIEW_AVAILABILITY_STATUS_LABELS = Object.fromEntries(
    REVIEW_AVAILABILITY_STATUS_OPTIONS.map((item) => [item.value, item.label])
  );

  function getReviewerDailyLimitMax() {
    const fromConfig = global.PALIGO_CONFIG?.reviewCapacity?.dailyLimitMax;
    const n = Number(fromConfig);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
  }

  function parseNonNegativeInt(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  }

  function normalizeReviewAvailability(raw) {
    const max = getReviewerDailyLimitMax();
    const source = raw && typeof raw === "object" ? { ...raw } : {};
    let status = String(source.status || "closed").trim();
    if (!REVIEW_AVAILABILITY_STATUS_LABELS[status]) status = "closed";

    let dailyLimit = parseNonNegativeInt(source.dailyLimit, 0);
    if (dailyLimit > max) dailyLimit = max;

    let queueSlots = parseNonNegativeInt(source.queueSlots, 0);
    if (status === "closed" || status === "full") queueSlots = 0;
    else if (queueSlots > dailyLimit) queueSlots = dailyLimit;

    if (status === "open" && dailyLimit < 1) {
      status = "closed";
      queueSlots = 0;
    }

    const acceptsSource = source.accepts && typeof source.accepts === "object" ? source.accepts : {};
    const accepts = {
      homework: acceptsSource.homework !== false,
      exam: acceptsSource.exam !== false,
    };
    if (!accepts.homework && !accepts.exam) {
      accepts.homework = true;
      accepts.exam = true;
    }

    return {
      status,
      dailyLimit,
      dailyLimitMax: max,
      queueSlots,
      accepts,
      note: String(source.note || "").trim().slice(0, 500),
      updatedAt:
        typeof source.updatedAt === "string" && source.updatedAt
          ? source.updatedAt
          : new Date().toISOString(),
    };
  }

  function formatReviewAvailabilityLabel(availability) {
    const av = normalizeReviewAvailability(availability);
    if (av.status === "closed") return REVIEW_AVAILABILITY_STATUS_LABELS.closed;
    if (av.status === "full") return REVIEW_AVAILABILITY_STATUS_LABELS.full;
    if (av.status === "limited") {
      if (av.queueSlots > 0) {
        return `${REVIEW_AVAILABILITY_STATUS_LABELS.limited} · ว่าง ${av.queueSlots} คิว`;
      }
      if (av.dailyLimit > 0) {
        return `${REVIEW_AVAILABILITY_STATUS_LABELS.limited} · สูงสุด ${av.dailyLimit} รายการ/วัน`;
      }
      return REVIEW_AVAILABILITY_STATUS_LABELS.limited;
    }
    if (av.dailyLimit > 0) {
      return `${REVIEW_AVAILABILITY_STATUS_LABELS.open} · สูงสุด ${av.dailyLimit} รายการ/วัน`;
    }
    return REVIEW_AVAILABILITY_STATUS_LABELS.open;
  }

  function validateReviewAvailabilityInput(raw) {
    const max = getReviewerDailyLimitMax();
    const source = raw && typeof raw === "object" ? raw : {};

    if (source.dailyLimit !== undefined && source.dailyLimit !== null && source.dailyLimit !== "") {
      const asNum = Number(source.dailyLimit);
      if (!Number.isFinite(asNum)) {
        return { ok: false, message: "จำนวนรับตรวจต่อวันต้องเป็นตัวเลข" };
      }
      if (asNum < 0) {
        return { ok: false, message: "จำนวนรับตรวจต่อวันต้องไม่ติดลบ" };
      }
    }

    if (source.queueSlots !== undefined && source.queueSlots !== null && source.queueSlots !== "") {
      const asNum = Number(source.queueSlots);
      if (!Number.isFinite(asNum)) {
        return { ok: false, message: "คิวว่างต้องเป็นตัวเลข" };
      }
      if (asNum < 0) {
        return { ok: false, message: "คิวว่างต้องไม่ติดลบ" };
      }
    }

    const beforeLimit = parseNonNegativeInt(source.dailyLimit, 0);
    const clamped = beforeLimit > max;
    const normalized = normalizeReviewAvailability(source);

    if (normalized.status === "open" && normalized.dailyLimit < 1) {
      return {
        ok: false,
        message: "เมื่อเลือกพร้อมรับตรวจ ต้องตั้งจำนวนรับตรวจต่อวันอย่างน้อย 1 รายการ",
      };
    }

    return { ok: true, value: normalized, clamped };
  }

  function collectReviewAvailabilityFromForm(root) {
    if (!root) return normalizeReviewAvailability(null);
    const status = root.querySelector("[data-field-availability-status]")?.value || "closed";
    const dailyLimit = root.querySelector("[data-field-daily-limit]")?.value;
    const queueSlots = root.querySelector("[data-field-queue-slots]")?.value;
    const acceptsHomework = root.querySelector("[data-field-accepts-homework]")?.checked;
    const acceptsExam = root.querySelector("[data-field-accepts-exam]")?.checked;
    return {
      status,
      dailyLimit,
      queueSlots,
      accepts: {
        homework: acceptsHomework !== false,
        exam: acceptsExam !== false,
      },
    };
  }

  const LEGACY_ROLE_MAP = {
    "teacher-reviewer": { profileStatus: "monk_teacher", capability: "teach_review" },
    teacher: { profileStatus: "monk_teacher", capability: "teach" },
    reviewer: { profileStatus: "reviewer", capability: "review" },
    assistant: { profileStatus: "teaching_assistant", capability: "teach" },
  };

  /** @deprecated — ใช้ profileStatus + capability แทน */
  const REVIEWER_KIND_OPTIONS = [
    { value: "teacher-reviewer", label: "ครูผู้สอนและผู้ตรวจ" },
    { value: "teacher", label: "ครูผู้สอน" },
    { value: "reviewer", label: "ผู้ตรวจ" },
    { value: "assistant", label: "ผู้ช่วยครู (เตรียมไว้)" },
  ];

  function inferProfileStatusFromPrefix(prefix) {
    const p = String(prefix || "").trim();
    if (p === "สามเณร") return "novice_teacher";
    if (p === "พระ" || p === "พระมหา") return "monk_teacher";
    return "";
  }

  function inferPrefixFromProfileStatus(profileStatus) {
    if (profileStatus === "monk_teacher") return "พระ";
    if (profileStatus === "novice_teacher") return "สามเณร";
    return "";
  }

  function normalizeReviewerProfile(profile) {
    const source = profile && typeof profile === "object" ? { ...profile } : {};
    let profileStatus = String(source.profileStatus || "").trim();
    let capability = String(source.capability || "").trim();
    const legacy = String(source.role || source.reviewerRole || "").trim();

    if (!profileStatus && legacy && LEGACY_ROLE_MAP[legacy]) {
      profileStatus = LEGACY_ROLE_MAP[legacy].profileStatus;
    }
    if (!capability && legacy && LEGACY_ROLE_MAP[legacy]) {
      capability = LEGACY_ROLE_MAP[legacy].capability;
    }
    if (!profileStatus && source.prefix) {
      profileStatus = inferProfileStatusFromPrefix(source.prefix) || profileStatus;
    }
    if (!profileStatus) {
      if (capability === "review") profileStatus = "reviewer";
      else profileStatus = "lay_teacher";
    }

    if (!PROFILE_STATUS_LABELS[profileStatus]) profileStatus = "monk_teacher";
    if (!CAPABILITY_LABELS[capability]) capability = "teach_review";

    source.profileStatus = profileStatus;
    source.capability = capability;
    source.role = legacyRoleFromCapability(capability);
    if (!source.prefix) source.prefix = inferPrefixFromProfileStatus(profileStatus);
    source.reviewAvailability = normalizeReviewAvailability(source.reviewAvailability);
    return source;
  }

  function legacyRoleFromCapability(capability) {
    if (capability === "teach") return "teacher";
    if (capability === "review") return "reviewer";
    if (capability === "teach_review") return "teacher-reviewer";
    return "teacher-reviewer";
  }

  function formatReviewerProfileLabel(profile, { short = false } = {}) {
    const { profileStatus, capability } = normalizeReviewerProfile(profile || {});
    const statusLabel = PROFILE_STATUS_LABELS[profileStatus] || PROFILE_STATUS_LABELS.monk_teacher;
    const capLabel = short
      ? CAPABILITY_SHORT_LABELS[capability] || CAPABILITY_SHORT_LABELS.teach_review
      : CAPABILITY_LABELS[capability] || CAPABILITY_LABELS.teach_review;
    return `${statusLabel} · ${capLabel}`;
  }

  function formatReviewerPeerLabel(displayName, profile, { short = true } = {}) {
    const name = String(displayName || "").trim() || "ครู";
    const status = formatReviewerProfileLabel(profile, { short });
    if (!profile?.profileStatus && !profile?.capability && !profile?.role) return name;
    return `${name} (${status})`;
  }

  function getShared() {
    return global.PaligoExamShared || null;
  }

  function profileInitial(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
  }

  const AVATAR_MAX_FILE_BYTES = 2 * 1024 * 1024;
  const AVATAR_MAX_DATA_URL_CHARS = 160_000;
  const AVATAR_OUTPUT_SIZE = 128;

  function getAvatarUrl(profile) {
    const url = String(profile?.avatarUrl || "").trim();
    if (!url.startsWith("data:image/")) return "";
    return url;
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
      img.src = src;
    });
  }

  function drawAvatarToCanvas(img, sx, sy, sSize, outputSize = AVATAR_OUTPUT_SIZE) {
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ไม่สามารถประมวลผลรูปได้");
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);
    return canvas;
  }

  function canvasToAvatarDataUrl(canvas) {
    let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > AVATAR_MAX_DATA_URL_CHARS) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.65);
    }
    if (dataUrl.length > AVATAR_MAX_DATA_URL_CHARS) {
      throw new Error("รูปยังใหญ่เกินไป — ลองใช้รูปที่เล็กลง");
    }
    return dataUrl;
  }

  function encodeSquareAvatar(img, sx, sy, sSize) {
    return canvasToAvatarDataUrl(drawAvatarToCanvas(img, sx, sy, sSize));
  }

  async function fileToAvatarDataUrl(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      throw new Error("เลือกไฟล์รูปภาพ (JPEG/PNG/WebP)");
    }
    if (file.size > AVATAR_MAX_FILE_BYTES) {
      throw new Error("รูปใหญ่เกินไป — ใช้ไฟล์ไม่เกิน 2 MB");
    }

    const raw = await readImageFile(file);
    const img = await loadImageElement(raw);
    const size = Math.min(img.width, img.height);
    const sx = Math.max(0, (img.width - size) / 2);
    const sy = Math.max(0, (img.height - size) / 2);
    return encodeSquareAvatar(img, sx, sy, size);
  }

  async function pickAvatarFromFile(file) {
    if (global.PaligoAvatarCrop?.open) {
      return global.PaligoAvatarCrop.open(file);
    }
    return fileToAvatarDataUrl(file);
  }

  function resolveSessionAvatar(role) {
    const client = global.PaligoInboxClient;
    const session = client?.getSession?.();
    const merged = mergeServerProfileJson(session?.user, loadLocalProfile(role || session?.user?.role));
    return getAvatarUrl(merged);
  }

  function buildStudentDisplayName(profile) {
    if (!profile) return "";
    const parts = [profile.prefix, profile.firstName, profile.lastName].filter(Boolean);
    const base = parts.join(" ").trim();
    if (profile.monasticName) {
      return base ? `${base} (${profile.monasticName})` : profile.monasticName;
    }
    return base;
  }

  function buildReviewerDisplayName(profile) {
    if (!profile) return "";
    return [profile.prefix, profile.name].filter(Boolean).join(" ").trim();
  }

  function suggestDisplayName(role, localProfile) {
    if (role === "student") {
      return (
        localProfile?.displayAlias ||
        buildStudentDisplayName(localProfile) ||
        ""
      );
    }
    if (role === "reviewer") {
      return (
        localProfile?.displayAlias ||
        buildReviewerDisplayName(localProfile) ||
        ""
      );
    }
    return "";
  }

  function loadLocalProfile(role) {
    const shared = getShared();
    if (!shared) return null;
    if (role === "student") {
      return (
        shared.getStudentProfile?.() || {
          userRole: "student",
          prefix: "พระ",
          firstName: "",
          lastName: "",
          monasticName: "",
          grade: "4",
          teacherName: "",
          teacherRole: "teacher-reviewer",
          deliveryMethod: "line",
          displayAlias: "",
        }
      );
    }
    if (role === "reviewer") {
      return normalizeReviewerProfile(
        shared.getReviewerProfile?.() || {
          prefix: "พระ",
          name: "",
          institution: "",
          profileStatus: "monk_teacher",
          capability: "teach_review",
          displayAlias: "",
        }
      );
    }
    return null;
  }

  function saveLocalProfile(role, profile) {
    const shared = getShared();
    if (!shared) return null;
    if (role === "student") return shared.saveStudentProfile?.(profile);
    if (role === "reviewer") return shared.saveReviewerProfile?.(profile);
    return null;
  }

  function mergeServerProfileJson(user, localProfile) {
    const server = user?.profileJson;
    if (!server || typeof server !== "object") return localProfile;
    const merged = { ...localProfile, ...server };
    if (user?.role === "reviewer") return normalizeReviewerProfile(merged);
    return merged;
  }

  async function syncToServer({ displayName, email, profileJson } = {}) {
    const client = global.PaligoInboxClient;
    if (!client?.updateMe) {
      throw new Error("Inbox client ไม่พร้อม — รีเฟรชหน้า");
    }
    const payload = await client.updateMe({
      displayName,
      email,
      profileJson,
    });
    return payload;
  }

  async function changePin(currentPin, newPin) {
    const client = global.PaligoInboxClient;
    if (!client?.changePin) {
      throw new Error("Inbox client ไม่พร้อม — รีเฟรชหน้า");
    }
    return client.changePin({ currentPin, newPin });
  }

  async function ensureLoggedIn(redirectPath = "exam-profile.html") {
    const client = global.PaligoInboxClient;
    if (!client) {
      global.location.href = `exam-account.html?return=${encodeURIComponent(redirectPath)}`;
      return null;
    }
    try {
      await client.ensureApiReady?.();
    } catch {
      /* offline API — still allow local profile edit */
    }
    const session = await client.ensureAuthenticatedSession?.();
    if (!session?.user) {
      global.location.href = `exam-account.html?return=${encodeURIComponent(redirectPath)}`;
      return null;
    }
    return session;
  }

  function formatThaiDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  async function copyText(text) {
    const value = String(text || "");
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  function fillReviewerRegisterFields(root) {
    if (!root) return;
    const statusSelect = root.querySelector("[name=profileStatus]");
    const capabilitySelect = root.querySelector("[name=capability]");
    if (statusSelect && !statusSelect.options.length) {
      REVIEWER_PROFILE_STATUS_OPTIONS.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        statusSelect.append(option);
      });
      statusSelect.value = "monk_teacher";
    }
    if (capabilitySelect && !capabilitySelect.options.length) {
      REVIEWER_CAPABILITY_OPTIONS.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        capabilitySelect.append(option);
      });
      capabilitySelect.value = "teach_review";
    }
  }

  function buildReviewerProfileJsonFromForm(data) {
    return normalizeReviewerProfile({
      profileStatus: String(data.get("profileStatus") || "monk_teacher"),
      capability: String(data.get("capability") || "teach_review"),
    });
  }

  function getRegisterWizardSteps(role) {
    if (role === "reviewer") {
      return ["role", "reviewer-status", "reviewer-capability", "account", "review"];
    }
    return ["role", "student", "account", "review"];
  }

  function getRegisterWizardStepCount(role) {
    return getRegisterWizardSteps(role).length;
  }

  function suggestRegisterDisplayName(state) {
    if (!state) return "";
    if (state.role === "student") {
      const parts = [state.prefix, state.firstName].filter(Boolean);
      return parts.join(" ").trim();
    }
    if (state.role === "reviewer") {
      return String(state.displayName || "").trim();
    }
    return "";
  }

  function buildProfileJsonFromRegisterWizard(state) {
    if (!state || !state.role) return null;
    if (state.role === "student") {
      return {
        userRole: "student",
        prefix: String(state.prefix || "").trim(),
        firstName: String(state.firstName || "").trim(),
        lastName: String(state.lastName || "").trim(),
        monasticName: String(state.monasticName || "").trim(),
        grade: String(state.grade || "4").trim(),
      };
    }
    return normalizeReviewerProfile({
      profileStatus: state.profileStatus,
      capability: state.capability,
      prefix: inferPrefixFromProfileStatus(state.profileStatus),
      name: String(state.displayName || "").trim(),
    });
  }

  function formatRegisterWizardSummary(state) {
    if (!state?.role) return "";
    if (state.role === "student") {
      const gradeLabel =
        GRADE_OPTIONS.find((item) => item.value === state.grade)?.label || state.grade;
      return `นักเรียน · ป.ธ. ${gradeLabel || "—"}`;
    }
    return formatReviewerProfileLabel({
      profileStatus: state.profileStatus,
      capability: state.capability,
    });
  }

  function validateRegisterWizardStep(stepId, state) {
    if (stepId === "role") {
      if (!state.role) return "เลือกบทบาทก่อน";
      return "";
    }
    if (stepId === "student") {
      if (!state.prefix) return "เลือกคำนำหน้า";
      if (!String(state.firstName || "").trim()) return "กรอกชื่อ";
      if (!state.grade) return "เลือกชั้น ป.ธ.";
      return "";
    }
    if (stepId === "reviewer-status") {
      if (!state.profileStatus) return "เลือกสถานะโปรไฟล์";
      return "";
    }
    if (stepId === "reviewer-capability") {
      if (!state.capability) return "เลือกหน้าที่ในระบบ";
      return "";
    }
    if (stepId === "account") {
      const name = String(state.displayName || "").trim();
      if (name.length < 2) return "ชื่อแสดงต้องมีอย่างน้อย 2 ตัวอักษร";
      const pin = String(state.pin || "");
      if (!/^\d{6,}$/.test(pin)) return "PIN ต้องเป็นตัวเลขอย่างน้อย 6 หลัก";
      return "";
    }
    return "";
  }

  function mountOptionTiles({ container, options, value, onChange, groupLabel }) {
    if (!container) return;
    container.replaceChildren();
    if (groupLabel) container.setAttribute("aria-label", groupLabel);
    container.setAttribute("role", "group");
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `wizard-option${opt.value === value ? " is-selected" : ""}`;
      btn.dataset.value = opt.value;
      btn.setAttribute("aria-pressed", String(opt.value === value));
      const title = document.createElement("span");
      title.className = "wizard-option__title";
      title.textContent = opt.label;
      btn.append(title);
      if (opt.helper) {
        const helper = document.createElement("span");
        helper.className = "wizard-option__helper";
        helper.textContent = opt.helper;
        btn.append(helper);
      }
      btn.addEventListener("click", () => {
        onChange(opt.value);
        container.querySelectorAll(".wizard-option").forEach((node) => {
          const selected = node.dataset.value === opt.value;
          node.classList.toggle("is-selected", selected);
          node.setAttribute("aria-pressed", String(selected));
        });
      });
      container.append(btn);
    });
  }

  function mountPrefixTiles({ container, value, onChange }) {
    mountOptionTiles({
      container,
      options: PREFIX_OPTIONS.map((label) => ({ value: label, label })),
      value,
      onChange,
      groupLabel: "คำนำหน้า",
    });
  }

  global.PaligoProfile = {
    ROLE_LABELS,
    PREFIX_OPTIONS,
    GRADE_OPTIONS,
    DELIVERY_OPTIONS,
    REVIEWER_PROFILE_STATUS_OPTIONS,
    REVIEWER_CAPABILITY_OPTIONS,
    REVIEWER_CAPABILITY_WIZARD_OPTIONS,
    REGISTER_ROLE_OPTIONS,
    REVIEW_AVAILABILITY_STATUS_OPTIONS,
    getReviewerDailyLimitMax,
    normalizeReviewAvailability,
    formatReviewAvailabilityLabel,
    validateReviewAvailabilityInput,
    collectReviewAvailabilityFromForm,
    REVIEWER_KIND_OPTIONS,
    normalizeReviewerProfile,
    formatReviewerProfileLabel,
    formatReviewerPeerLabel,
    legacyRoleFromCapability,
    profileInitial,
    getAvatarUrl,
    fileToAvatarDataUrl,
    pickAvatarFromFile,
    encodeSquareAvatar,
    resolveSessionAvatar,
    buildStudentDisplayName,
    buildReviewerDisplayName,
    suggestDisplayName,
    loadLocalProfile,
    saveLocalProfile,
    mergeServerProfileJson,
    syncToServer,
    changePin,
    ensureLoggedIn,
    formatThaiDate,
    copyText,
    fillReviewerRegisterFields,
    buildReviewerProfileJsonFromForm,
    getRegisterWizardSteps,
    getRegisterWizardStepCount,
    suggestRegisterDisplayName,
    buildProfileJsonFromRegisterWizard,
    formatRegisterWizardSummary,
    validateRegisterWizardStep,
    mountOptionTiles,
    mountPrefixTiles,
    inferPrefixFromProfileStatus,
    inferProfileStatusFromPrefix,
  };
})(typeof window !== "undefined" ? window : globalThis);
