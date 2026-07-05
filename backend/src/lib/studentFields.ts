/**
 * Helpers for the two new student fields — blood group and date of birth.
 * Used by both the manual create/update path and the bulk-import path so the
 * stored values are always consistent (e.g. "B +ve" and "B+" both become "B+").
 */

function pad(n: string | number): string {
  return String(n).padStart(2, '0');
}

/** Normalise free-form blood group text to a canonical form: "B +ve" → "B+". */
export function normalizeBloodGroup(raw?: string | null): string | undefined {
  if (raw == null) return undefined;
  let s = String(raw).toUpperCase().replace(/\s+/g, '');
  if (!s) return undefined;
  s = s.replace(/\+VE|POSITIVE/g, '+').replace(/-VE|NEGATIVE/g, '-').replace(/[()]/g, '');
  return s.slice(0, 8) || undefined;
}

/**
 * Parse a date of birth into "YYYY-MM-DD". Accepts ISO (2007-11-30) and the
 * common spreadsheet form M/D/YY or M/D/YYYY (11/30/07). Two-digit years <= 30
 * are treated as 20xx, otherwise 19xx. Returns undefined if unparseable.
 */
export function parseDob(raw?: string | null): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const mm = Number(iso[2]);
    const dd = Number(iso[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
    return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  }

  const slash = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (slash) {
    const mm = Number(slash[1]);
    const dd = Number(slash[2]);
    let year = Number(slash[3]);
    if (slash[3].length <= 2) year = year <= 30 ? 2000 + year : 1900 + year;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
    return `${year}-${pad(slash[1])}-${pad(slash[2])}`;
  }

  return undefined;
}

/** Normalise a DATE value coming back from mysql2 (string or Date) to YYYY-MM-DD. */
export function toDateString(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  return undefined;
}
