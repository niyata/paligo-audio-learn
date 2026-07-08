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

  const REVIEWER_KIND_OPTIONS = [
    { value: "teacher-reviewer", label: "ครูผู้สอนและผู้ตรวจ" },
    { value: "teacher", label: "ครูผู้สอน" },
    { value: "reviewer", label: "ผู้ตรวจ" },
    { value: "assistant", label: "ผู้ช่วยครู (เตรียมไว้)" },
  ];

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
      return (
        shared.getReviewerProfile?.() || {
          prefix: "พระ",
          name: "",
          institution: "",
          role: "teacher-reviewer",
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
    return { ...localProfile, ...server };
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

  global.PaligoProfile = {
    ROLE_LABELS,
    PREFIX_OPTIONS,
    GRADE_OPTIONS,
    DELIVERY_OPTIONS,
    REVIEWER_KIND_OPTIONS,
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
  };
})(typeof window !== "undefined" ? window : globalThis);
