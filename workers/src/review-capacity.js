/**
 * Reviewer capacity / reviewAvailability — canonical server constants + helpers (#76)
 */

export const DEFAULT_REVIEWER_DAILY_LIMIT_MAX = 60;

export const REVIEW_AVAILABILITY_STATUS_VALUES = ["open", "limited", "full", "closed"];

const STATUS_LABELS = {
  open: "พร้อมรับตรวจ",
  limited: "รับได้จำกัด",
  full: "คิวเต็ม",
  closed: "ยังไม่พร้อมตรวจ",
};

const ACCEPT_KEYS = ["homework", "exam"];

function parseNonNegativeInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

/**
 * Normalize reviewAvailability stored on profileJson (full private shape).
 * @param {unknown} raw
 * @param {{ dailyLimitMax?: number }} [options]
 */
export function normalizeReviewAvailability(raw, { dailyLimitMax = DEFAULT_REVIEWER_DAILY_LIMIT_MAX } = {}) {
  const max = parseNonNegativeInt(dailyLimitMax, DEFAULT_REVIEWER_DAILY_LIMIT_MAX);
  const source = raw && typeof raw === "object" ? { ...raw } : {};
  let status = String(source.status || "closed").trim();
  if (!REVIEW_AVAILABILITY_STATUS_VALUES.includes(status)) status = "closed";

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

  const note = String(source.note || "").trim().slice(0, 500);
  const updatedAt =
    typeof source.updatedAt === "string" && source.updatedAt
      ? source.updatedAt
      : new Date().toISOString();

  return {
    status,
    dailyLimit,
    dailyLimitMax: max,
    queueSlots,
    accepts,
    note,
    updatedAt,
  };
}

export function formatReviewAvailabilityLabel(availability) {
  const av = normalizeReviewAvailability(availability);
  if (av.status === "closed") return STATUS_LABELS.closed;
  if (av.status === "full") return STATUS_LABELS.full;
  if (av.status === "limited") {
    if (av.queueSlots > 0) return `${STATUS_LABELS.limited} · ว่าง ${av.queueSlots} คิว`;
    if (av.dailyLimit > 0) return `${STATUS_LABELS.limited} · สูงสุด ${av.dailyLimit} รายการ/วัน`;
    return STATUS_LABELS.limited;
  }
  if (av.dailyLimit > 0) {
    return `${STATUS_LABELS.open} · สูงสุด ${av.dailyLimit} รายการ/วัน`;
  }
  return STATUS_LABELS.open;
}

/** Public-safe badge for people/reviewer search — no note/private fields */
export function publicReviewAvailabilityFields(profileJson) {
  const profile = profileJson && typeof profileJson === "object" ? profileJson : null;
  const av = normalizeReviewAvailability(profile?.reviewAvailability);
  const accepts = [];
  if (av.accepts.homework) accepts.push("homework");
  if (av.accepts.exam) accepts.push("exam");
  return {
    status: av.status,
    dailyLimit: av.dailyLimit,
    queueSlots: av.queueSlots,
    accepts,
    label: formatReviewAvailabilityLabel(av),
  };
}

/**
 * Validate user input before save (client or server).
 * @returns {{ ok: true, value: object } | { ok: false, message: string, clamped?: boolean }}
 */
export function validateReviewAvailabilityInput(raw, { dailyLimitMax = DEFAULT_REVIEWER_DAILY_LIMIT_MAX } = {}) {
  const max = parseNonNegativeInt(dailyLimitMax, DEFAULT_REVIEWER_DAILY_LIMIT_MAX);
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
  const normalized = normalizeReviewAvailability(source, { dailyLimitMax: max });

  if (normalized.status === "open" && normalized.dailyLimit < 1) {
    return {
      ok: false,
      message: "เมื่อเลือกพร้อมรับตรวจ ต้องตั้งจำนวนรับตรวจต่อวันอย่างน้อย 1 รายการ",
    };
  }

  return { ok: true, value: normalized, clamped };
}

export function mergeReviewAvailabilityIntoProfile(profile) {
  const source = profile && typeof profile === "object" ? { ...profile } : {};
  source.reviewAvailability = normalizeReviewAvailability(source.reviewAvailability);
  return source;
}
