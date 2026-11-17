import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__art">{icon}</div>
      <div>
        <p className="empty__title">{title}</p>
        <p className="empty__text" style={{ marginTop: 'var(--space-2)' }}>
          {text}
        </p>
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return (
    <div className="empty" role="status">
      <span className="spinner spinner--lg" />
      <p className="empty__text">{label}</p>
    </div>
  );
}
