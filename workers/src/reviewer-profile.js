/**
 * Reviewer profileStatus / capability — shared label helpers (server-safe, no PII)
 */

export const REVIEWER_PROFILE_STATUS_VALUES = [
  "monk_teacher",
  "novice_teacher",
  "lay_teacher",
  "teaching_assistant",
  "reviewer",
];

export const REVIEWER_CAPABILITY_VALUES = ["teach", "review", "teach_review"];

const PROFILE_STATUS_LABELS = {
  monk_teacher: "พระอาจารย์",
  novice_teacher: "สามเณรอาจารย์",
  lay_teacher: "อาจารย์ฆราวาส",
  teaching_assistant: "ผู้ช่วยสอน",
  reviewer: "ผู้ตรวจ",
};

const CAPABILITY_LABELS = {
  teach: "ครูผู้สอน",
  review: "ผู้ตรวจ",
  teach_review: "ครูผู้สอนและผู้ตรวจ",
};

const CAPABILITY_SHORT_LABELS = {
  teach: "สอน",
  review: "ตรวจ",
  teach_review: "สอน·ตรวจ",
};

const LEGACY_ROLE_MAP = {
  "teacher-reviewer": { profileStatus: "monk_teacher", capability: "teach_review" },
  teacher: { profileStatus: "monk_teacher", capability: "teach" },
  reviewer: { profileStatus: "reviewer", capability: "review" },
  assistant: { profileStatus: "teaching_assistant", capability: "teach" },
};

export function normalizeReviewerProfileFields(profile) {
  const source = profile && typeof profile === "object" ? profile : {};
  let profileStatus = String(source.profileStatus || "").trim();
  let capability = String(source.capability || "").trim();
  const legacy = String(source.role || source.reviewerRole || "").trim();

  if ((!profileStatus || !REVIEWER_PROFILE_STATUS_VALUES.includes(profileStatus)) && legacy && LEGACY_ROLE_MAP[legacy]) {
    profileStatus = LEGACY_ROLE_MAP[legacy].profileStatus;
  }
  if ((!capability || !REVIEWER_CAPABILITY_VALUES.includes(capability)) && legacy && LEGACY_ROLE_MAP[legacy]) {
    capability = LEGACY_ROLE_MAP[legacy].capability;
  }

  if (!REVIEWER_PROFILE_STATUS_VALUES.includes(profileStatus)) profileStatus = "monk_teacher";
  if (!REVIEWER_CAPABILITY_VALUES.includes(capability)) capability = "teach_review";

  return { profileStatus, capability };
}

export function formatReviewerRoleLabel(profile, { short = false } = {}) {
  const { profileStatus, capability } = normalizeReviewerProfileFields(profile);
  const statusLabel = PROFILE_STATUS_LABELS[profileStatus] || PROFILE_STATUS_LABELS.monk_teacher;
  const capLabel = short
    ? CAPABILITY_SHORT_LABELS[capability] || CAPABILITY_SHORT_LABELS.teach_review
    : CAPABILITY_LABELS[capability] || CAPABILITY_LABELS.teach_review;
  return `${statusLabel} · ${capLabel}`;
}

export function publicReviewerProfileFields(profileJson) {
  const profile = profileJson && typeof profileJson === "object" ? profileJson : null;
  const { profileStatus, capability } = normalizeReviewerProfileFields(profile);
  const avatarUrl = String(profile?.avatarUrl || "").trim();
  return {
    profileStatus,
    capability,
    roleLabel: formatReviewerRoleLabel(profile),
    avatarUrl: avatarUrl.startsWith("data:image/") ? avatarUrl : null,
  };
}
