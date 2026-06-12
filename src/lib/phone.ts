// Phone normalization → canonical digits-only form, US country code stripped.
//
// One canonical form means uniqueness checks against profiles.phone can't
// be bypassed by formatting tricks. See the longer comment in
// src/app/(auth)/login/actions.ts.
//
// Returns null if the input doesn't normalize to a valid 10–15 digit phone.
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  // US country code: 11 digits starting with "1" → drop the leading 1 so
  // "+1 555 123 4567" and "5551234567" collide on uniqueness lookup.
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}
