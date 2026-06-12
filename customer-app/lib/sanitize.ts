// ============================================================
// NEXUS MACHINERY — INPUT SANITIZATION
// Mirrors the sanitization logic from website/script.js
// All user input MUST pass through these functions before
// being saved to Firestore or displayed in the UI.
// ============================================================

/**
 * Sanitizes a plain text field.
 * Strips all HTML, script tags, and dangerous characters.
 */
export function sanitizeText(input: unknown, maxLength = 500): string {
  if (input === null || input === undefined) return '';

  let clean = String(input);
  clean = clean.trim();

  // Strip all HTML tags
  clean = clean.replace(/<[^>]*>/g, '');

  // Remove injection characters
  clean = clean.replace(/[<>"'`\\{}\[\];|&^]/g, '');

  // Remove javascript: / data: / vbscript: protocols
  clean = clean.replace(/javascript\s*:/gi, '');
  clean = clean.replace(/data\s*:/gi, '');
  clean = clean.replace(/vbscript\s*:/gi, '');

  // Remove null bytes and control chars
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Collapse multiple whitespace
  clean = clean.replace(/\s+/g, ' ');

  // Hard length limit
  clean = clean.substring(0, maxLength);

  return clean;
}

/**
 * Validates and sanitizes a phone number.
 * Only accepts valid Indian mobile numbers (10 digits, starts with 6-9).
 * Returns null if invalid.
 */
export function sanitizePhone(input: unknown): string | null {
  if (!input) return null;

  const digits = String(input).replace(/\D/g, '');

  if (!/^[6-9]\d{9}$/.test(digits)) return null;

  return digits;
}

/**
 * Validates and sanitizes an email address.
 * Returns empty string if blank (optional field).
 * Returns null if invalid format.
 */
export function sanitizeEmail(input: unknown): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return ''; // Optional — blank is OK

  const clean = sanitizeText(raw, 254).toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) return null;

  return clean;
}

export class ValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Field character limits (matches website)
 */
const LIMITS: Record<string, number> = {
  name: 100,
  company: 150,
  location: 300,
  message: 1000,
  type: 50,
  machineType: 50,
  supportType: 50,
  automationType: 50,
  productName: 200,
  timestamp: 50,
};

/**
 * Sanitizes a complete form data object before sending to Firebase.
 * Throws ValidationError on invalid phone/email.
 */
export function sanitizeFormData(data: Record<string, unknown>): Record<string, string> {
  const safe: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === 'phone' || key === 'email') continue;
    const limit = LIMITS[key] ?? 500;
    safe[key] = sanitizeText(value, limit);
  }

  // Phone (required in most forms)
  if (data.phone !== undefined) {
    const cleanPhone = sanitizePhone(data.phone);
    if (cleanPhone === null) {
      throw new ValidationError(
        'INVALID_PHONE',
        'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).'
      );
    }
    safe.phone = cleanPhone;
  }

  // Email (optional but must be valid if provided)
  if (data.email !== undefined) {
    const cleanEmail = sanitizeEmail(data.email);
    if (cleanEmail === null) {
      throw new ValidationError(
        'INVALID_EMAIL',
        'The email address format is invalid. Please correct it or leave it blank.'
      );
    }
    safe.email = cleanEmail;
  }

  return safe;
}
