/**
 * GERA Persian Date and Numeral Utilities
 */

/**
 * Returns an ISO 8601 string with the local time zone offset.
 * Example: "2026-10-05T15:12:18+03:30"
 */
export function getISOStringWithOffset(date: Date = new Date()): string {
  const pad = (num: number, digits: number = 2) => String(num).padStart(digits, '0');
  
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
}

/**
 * Converts English digits (0-9) to Persian digits (۰-۹).
 */
export function toPersianDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  const str = String(input);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

/**
 * Formats an ISO date into full Shamsi date and time.
 * Example: ۱۵ مهر ۱۴۰۵، ساعت ۱۵:۱۲
 */
export function formatShamsiDateTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    return isoString;
  }
}

/**
 * Formats an ISO date into Shamsi date only.
 * Example: ۱۵ مهر ۱۴۰۵
 */
export function formatShamsiDate(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(date);
  } catch {
    return isoString;
  }
}

/**
 * Formats time only in Persian.
 * Example: ۱۵:۱۲
 */
export function formatShamsiTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    return isoString;
  }
}
