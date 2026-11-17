import { useCallback } from 'react';
import { copyToClipboard } from '@/services/clipboardService';
import { useToast } from '@/state/ToastProvider';
import { useVault } from '@/state/VaultProvider';

/**
 * Copy helper that respects the user's clipboard-clearing setting and reports
 * honestly whether the clipboard will actually be cleared.
 */
export function useCopy() {
  const toast = useToast();
  const { settings } = useVault();

  return useCallback(
    async (
      value: string,
      label: string,
      options: { sensitive?: boolean } = {},
    ): Promise<void> => {
      if (value.length === 0) {
        toast.info(`${label} bo‘sh`, 'Nusxa olish uchun qiymat yo‘q.');
        return;
      }

      const sensitive = options.sensitive ?? false;
      const clearAfterSeconds = sensitive ? settings.clearClipboardSeconds : 0;
      const result = await copyToClipboard(value, {
        clearAfterSeconds,
        slot: sensitive ? 'secret' : 'plain',
      });

      if (!result.ok) {
        toast.error('Nusxa olinmadi', result.error);
        return;
      }

      toast.success(
        `${label} nusxalandi`,
        result.willClear
          ? `Clipboard ${String(clearAfterSeconds)} soniyadan keyin tozalanadi.`
          : undefined,
      );
    },
    [settings.clearClipboardSeconds, toast],
  );
}
