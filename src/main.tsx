import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import { ThemeProvider, readStoredPreference, resolveTheme } from '@/state/ThemeProvider';
import { ToastProvider } from '@/state/ToastProvider';
import { VaultProvider } from '@/state/VaultProvider';
import '@/styles/app.css';

// Apply the stored theme before the first paint so there is no flash of the
// wrong palette while React mounts.
document.documentElement.dataset['theme'] = resolveTheme(readStoredPreference());

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root topilmadi');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <VaultProvider>
          <App />
        </VaultProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
