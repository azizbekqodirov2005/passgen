import { useEffect, useRef, useState } from 'react';
import {
  IconClock,
  IconDownload,
  IconKey,
  IconLock,
  IconMenu,
  IconMoon,
  IconPlus,
  IconSearch,
  IconShield,
  IconSun,
  IconUser,
} from '@/components/icons';
import { useTheme } from '@/state/ThemeProvider';
import { authenticationService } from '@/services/authenticationService';
import { formatCountdown } from '@/lib/format';
import type { Route } from '@/hooks/useRoute';

interface TopbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onNavigate: (route: Route) => void;
  onOpenMenu: () => void;
  onAdd: () => void;
  onLock: () => void;
  onExport: () => void;
  score: number;
  total: number;
  searchRef: React.RefObject<HTMLInputElement>;
}

function scoreTone(score: number, total: number): { dot: string; label: string } {
  if (total === 0) return { dot: '', label: 'Ombor bo‘sh' };
  if (score >= 80) return { dot: '', label: 'Xavfsizlik yaxshi' };
  if (score >= 55)
    return { dot: ' status-chip__dot--warning', label: 'E’tibor talab qiladi' };
  return { dot: ' status-chip__dot--danger', label: 'Xavf yuqori' };
}

export function Topbar({
  query,
  onQueryChange,
  onNavigate,
  onOpenMenu,
  onAdd,
  onLock,
  onExport,
  score,
  total,
  searchRef,
}: TopbarProps) {
  const { resolved, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(
    authenticationService.msUntilLock,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const tone = scoreTone(score, total);

  // Live countdown to the auto-lock, so the user is never surprised by it.
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(authenticationService.msUntilLock);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="topbar">
      <button
        type="button"
        className="btn btn--icon topbar__menu"
        onClick={onOpenMenu}
        aria-label="Menyuni ochish"
      >
        <IconMenu size={18} />
      </button>

      <div className="search" role="search">
        <IconSearch size={15} className="search__icon" />
        <input
          ref={searchRef}
          className="search__input"
          type="search"
          value={query}
          placeholder="Platforma, foydalanuvchi yoki sayt bo‘yicha qidirish"
          aria-label="Omborda qidirish"
          onChange={(event) => {
            onQueryChange(event.target.value);
            if (event.target.value.length > 0) onNavigate('passwords');
          }}
        />
        <span className="search__hint" aria-hidden="true">
          <kbd className="kbd">/</kbd>
        </span>
      </div>

      <span className="u-spacer" />

      <div className="topbar__status u-row">
        <span className="status-chip" title="Ombor xavfsizlik holati">
          <span className={`status-chip__dot${tone.dot}`} />
          {tone.label}
        </span>
        {remaining !== null ? (
          <span className="status-chip u-mono" title="Avtomatik qulflashgacha qolgan vaqt">
            <IconClock size={14} />
            {formatCountdown(remaining)}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        className="btn btn--icon topbar__tool"
        onClick={() => onNavigate('generator')}
        aria-label="Parol generatori"
        title="Parol generatori"
      >
        <IconKey size={17} />
      </button>

      <button
        type="button"
        className="btn btn--icon topbar__tool"
        onClick={toggle}
        aria-label={resolved === 'dark' ? 'Yorug‘ rejimga o‘tish' : 'Tungi rejimga o‘tish'}
        title={resolved === 'dark' ? 'Yorug‘ rejim' : 'Tungi rejim'}
      >
        {resolved === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
      </button>

      <button
        type="button"
        className="btn btn--primary topbar__add"
        onClick={onAdd}
        aria-label="Yangi yozuv"
      >
        <IconPlus size={16} />
        <span className="topbar__add-label">Yangi yozuv</span>
      </button>

      <div className="dropdown" ref={menuRef}>
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Profil menyusi"
        >
          <IconUser size={17} />
        </button>

        {menuOpen ? (
          <div className="dropdown__panel" role="menu">
            <div className="dropdown__header">
              <div className="u-label">Mahalliy ombor</div>
              <div className="u-row" style={{ marginTop: 'var(--space-2)' }}>
                <IconShield size={14} className="u-dim" />
                <span style={{ fontSize: 'var(--text-sm)' }}>
                  {total} yozuv · {score}/100
                </span>
              </div>
            </div>

            <button
              type="button"
              className="dropdown__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onNavigate('audit');
              }}
            >
              <IconShield size={16} />
              Xavfsizlik tahlili
            </button>
            <button
              type="button"
              className="dropdown__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onExport();
              }}
            >
              <IconDownload size={16} />
              Zaxira nusxa olish
            </button>
            <button
              type="button"
              className="dropdown__item dropdown__item--danger"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onLock();
              }}
            >
              <IconLock size={16} />
              Omborni qulflash
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
