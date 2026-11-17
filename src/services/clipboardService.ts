/**
 * clipboardService — copy a secret, then clear it again.
 *
 * Browsers do not let a page read the clipboard without a user gesture and a
 * permission grant, so PassGen cannot verify that the value it wrote is still
 * there. What it can do is overwrite the clipboard after a short delay, which
 * removes the secret in the common case. The function reports honestly whether
 * clearing was scheduled.
 */

export interface CopyResult {
  ok: boolean;
  /** True when an automatic clipboard clear was scheduled. */
  willClear: boolean;
  error?: string;
}

const timers = new Map<string, number>();

async function writeClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the legacy path (permission denied, insecure context).
    }
  }

  // Legacy fallback for browsers without the async clipboard API.
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.value = '';
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

/**
 * Copy a value. When `clearAfterSeconds` is above zero the clipboard is
 * overwritten with an empty string after that delay.
 */
export async function copyToClipboard(
  value: string,
  options: { clearAfterSeconds?: number; slot?: string } = {},
): Promise<CopyResult> {
  const { clearAfterSeconds = 0, slot = 'default' } = options;

  const ok = await writeClipboard(value);
  if (!ok) {
    return {
      ok: false,
      willClear: false,
      error: "Brauzer nusxa olishga ruxsat bermadi. Qiymatni qo'lda belgilab ko'chiring.",
    };
  }

  const existing = timers.get(slot);
  if (existing !== undefined) {
    window.clearTimeout(existing);
    timers.delete(slot);
  }

  if (clearAfterSeconds > 0) {
    const timer = window.setTimeout(() => {
      void writeClipboard('');
      timers.delete(slot);
    }, clearAfterSeconds * 1000);
    timers.set(slot, timer);
    return { ok: true, willClear: true };
  }

  return { ok: true, willClear: false };
}

/** Cancel pending clears — called when the app locks or unmounts. */
export function cancelScheduledClears(): void {
  for (const timer of timers.values()) {
    window.clearTimeout(timer);
  }
  timers.clear();
}
