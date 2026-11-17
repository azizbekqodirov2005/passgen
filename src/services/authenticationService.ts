/**
 * authenticationService — lock state, auto-lock and re-authentication windows.
 *
 * Auto-lock is driven by real user activity. The timer is also checked against
 * wall-clock time, so putting the laptop to sleep does not buy extra unlocked
 * minutes once it wakes up.
 */

import { vaultService } from '@/services/vaultService';

export const AUTO_LOCK_CHOICES = [1, 5, 15, 30, 60, 0] as const;
/** How long a successful re-auth stays valid for reveal actions. */
export const REAUTH_WINDOW_MS = 2 * 60 * 1000;

type Listener = () => void;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'focus',
];

export class AuthenticationService {
  private lastActivity = Date.now();
  private lastReauth = 0;
  private autoLockMs = 15 * 60 * 1000;
  private intervalId: number | null = null;
  private listeners = new Set<Listener>();
  private detachActivity: (() => void) | null = null;

  /** Start watching activity. Returns a cleanup function (no leaks). */
  start(): () => void {
    this.touch();
    this.attachActivityListeners();

    if (this.intervalId === null && typeof window !== 'undefined') {
      this.intervalId = window.setInterval(() => this.tick(), 5_000);
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Catch the case where the tab was hidden past the auto-lock window.
        this.tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
      document.removeEventListener('visibilitychange', onVisibility);
      this.detachActivity?.();
      this.detachActivity = null;
    };
  }

  private attachActivityListeners(): void {
    if (typeof window === 'undefined' || this.detachActivity) return;
    const handler = () => this.touch();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }
    this.detachActivity = () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handler);
      }
    };
  }

  onAutoLock(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setAutoLockMinutes(minutes: number): void {
    this.autoLockMs = Math.max(0, minutes) * 60 * 1000;
    this.touch();
  }

  /** 0 means "never auto-lock". */
  get autoLockMinutes(): number {
    return Math.round(this.autoLockMs / 60_000);
  }

  touch(): void {
    this.lastActivity = Date.now();
  }

  get idleMs(): number {
    return Date.now() - this.lastActivity;
  }

  get msUntilLock(): number | null {
    if (this.autoLockMs === 0) return null;
    return Math.max(0, this.autoLockMs - this.idleMs);
  }

  markReauthenticated(): void {
    this.lastReauth = Date.now();
    this.touch();
  }

  clearReauth(): void {
    this.lastReauth = 0;
  }

  /** True while a recent master-password confirmation is still valid. */
  hasFreshReauth(): boolean {
    return this.lastReauth > 0 && Date.now() - this.lastReauth < REAUTH_WINDOW_MS;
  }

  lockNow(): void {
    vaultService.lock();
    this.clearReauth();
    for (const listener of this.listeners) listener();
  }

  private tick(): void {
    if (!vaultService.isUnlocked()) return;
    if (this.autoLockMs === 0) return;
    if (this.idleMs >= this.autoLockMs) {
      this.lockNow();
    }
  }
}

export const authenticationService = new AuthenticationService();
