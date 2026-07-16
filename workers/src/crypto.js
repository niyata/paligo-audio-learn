/**
 * IDs + PIN hashing (Web Crypto PBKDF2)
 */

export function createId() {
  return crypto.randomUUID();
}

export function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export async function hashPin(pin, saltHex) {
  const enc = new TextEncoder();
  const saltBytes = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export function createSaltHex() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function verifyPin(pin, saltHex, expectedHash) {
  const actual = await hashPin(pin, saltHex);
  return timingSafeEqual(actual, expectedHash);
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isValidPin(pin) {
  return typeof pin === "string" && /^\d{6,}$/.test(pin);
}

export function isValidRole(role) {
  return role === "student" || role === "reviewer";
}

export function normalizeEmail(email) {
  if (email == null || email === "") return null;
  const value = String(email).trim().toLowerCase();
  return value || null;
}

export function normalizeDisplayName(name) {
  return String(name || "").trim();
}
