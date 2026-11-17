/**
 * Vitest setup: provide an in-memory IndexedDB and the Web Crypto API so the
 * security-critical services can be tested exactly as they run in the browser.
 */
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
