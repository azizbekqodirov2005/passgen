/** Formatting helpers. Uzbek wording, no external date library. */

const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

export function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return `${String(date.getDate())} ${MONTHS[date.getMonth()] ?? ''} ${String(date.getFullYear())}`;
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${formatDate(timestamp)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "3 daqiqa oldin", "kecha", "2 hafta oldin" … */
export function formatRelative(timestamp: number): string {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return 'hozir';
  if (minutes < 60) return `${String(minutes)} daqiqa oldin`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} soat oldin`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'kecha';
  if (days < 7) return `${String(days)} kun oldin`;
  if (days < 30) return `${String(Math.floor(days / 7))} hafta oldin`;
  if (days < 365) return `${String(Math.floor(days / 30))} oy oldin`;
  return `${String(Math.floor(days / 365))} yil oldin`;
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

/** "mail.google.com" from "https://mail.google.com/mail/u/0" */
export function hostFromUrl(url: string): string {
  if (url.trim().length === 0) return '';
  try {
    return new URL(url.includes('://') ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

/** Make a user-typed address safe to put in href. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    // Only http(s): blocks javascript: and data: URLs from stored records.
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function initials(name: string): string {
  const cleaned = name.trim();
  if (cleaned.length === 0) return '?';
  const words = cleaned.split(/\s+/u);
  if (words.length === 1) return cleaned.slice(0, 2);
  return `${words[0]?.charAt(0) ?? ''}${words[1]?.charAt(0) ?? ''}`;
}

/** Uzbek plural-free counting phrase: "12 yozuv". */
export function countLabel(count: number, noun: string): string {
  return `${String(count)} ${noun}`;
}

export function maskedValue(length: number): string {
  return '•'.repeat(Math.min(Math.max(length, 8), 16));
}
