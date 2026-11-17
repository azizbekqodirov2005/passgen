import { useState } from 'react';
import {
  IconCopy,
  IconEdit,
  IconExternal,
  IconEye,
  IconEyeOff,
  IconSort,
  IconStar,
  IconTrash,
} from '@/components/icons';
import { StrengthBadge } from '@/components/ui/StrengthMeter';
import { categoryHue, categoryLabel } from '@/lib/categories';
import { formatRelative, hostFromUrl, initials, maskedValue, safeHref } from '@/lib/format';
import { useCopy } from '@/hooks/useCopy';
import type { Credential, CustomCategory, SortDirection, SortKey } from '@/lib/types';

interface CredentialTableProps {
  credentials: Credential[];
  categories: CustomCategory[];
  sort: { key: SortKey; direction: SortDirection };
  onSortChange: (key: SortKey) => void;
  onEdit: (credential: Credential) => void;
  onDelete: (credential: Credential) => void;
  onToggleFavorite: (credential: Credential) => void;
  /** Resolve to false to keep the password hidden (re-authentication failed). */
  onBeforeReveal: () => Promise<boolean>;
}

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: 'name', label: 'Platforma' },
  { key: null, label: 'Foydalanuvchi' },
  { key: null, label: 'Parol' },
  { key: 'security', label: 'Kuch' },
  { key: null, label: 'Kategoriya' },
  { key: 'updated', label: 'Yangilangan' },
];

export function CredentialTable({
  credentials,
  categories,
  sort,
  onSortChange,
  onEdit,
  onDelete,
  onToggleFavorite,
  onBeforeReveal,
}: CredentialTableProps) {
  const copy = useCopy();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggleReveal = async (credential: Credential) => {
    if (revealed.has(credential.id)) {
      setRevealed((current) => {
        const next = new Set(current);
        next.delete(credential.id);
        return next;
      });
      return;
    }
    const allowed = await onBeforeReveal();
    if (!allowed) return;
    setRevealed((current) => new Set(current).add(credential.id));
  };

  return (
    <div className="table-wrap">
      <table className="table table--responsive">
        <thead>
          <tr>
            {COLUMNS.map((column) =>
              column.key ? (
                <th key={column.label} className="is-sortable" scope="col">
                  <button
                    type="button"
                    onClick={() => onSortChange(column.key as SortKey)}
                    aria-label={`${column.label} bo‘yicha saralash`}
                  >
                    {column.label}
                    {sort.key === column.key ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          rotate: sort.direction === 'asc' ? '180deg' : '0deg',
                          color: 'var(--accent)',
                        }}
                      >
                        <IconSort />
                      </span>
                    ) : null}
                  </button>
                </th>
              ) : (
                <th key={column.label} scope="col">
                  {column.label}
                </th>
              ),
            )}
            <th scope="col">
              <span className="u-visually-hidden">Amallar</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {credentials.map((credential) => {
            const isRevealed = revealed.has(credential.id);
            const href = safeHref(credential.url);
            const host = hostFromUrl(credential.url);

            return (
              <tr key={credential.id}>
                <td data-label="Platforma">
                  <div className="entry">
                    <span className="entry__mark" aria-hidden="true">
                      {initials(credential.name)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        className="entry__name-button u-truncate"
                        onClick={() => onEdit(credential)}
                      >
                        {credential.name}
                      </button>
                      {host ? (
                        <span className="entry__meta u-truncate">
                          {href ? (
                            <a href={href} target="_blank" rel="noreferrer noopener">
                              <span className="u-row">
                                {host}
                                <IconExternal size={11} />
                              </span>
                            </a>
                          ) : (
                            host
                          )}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </td>

                <td data-label="Foydalanuvchi">
                  {credential.username.length > 0 ? (
                    <div className="secret">
                      <span className="secret__value u-truncate">{credential.username}</span>
                      <button
                        type="button"
                        className="btn btn--icon btn--sm"
                        onClick={() => void copy(credential.username, 'Foydalanuvchi nomi')}
                        aria-label="Foydalanuvchi nomini nusxalash"
                        title="Nusxalash"
                      >
                        <IconCopy size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="u-dim">—</span>
                  )}
                </td>

                <td data-label="Parol">
                  <div className="secret">
                    <span
                      className={`secret__value ${
                        isRevealed ? 'secret__value--revealed' : 'secret__value--hidden'
                      }`}
                    >
                      {credential.password.length === 0
                        ? '—'
                        : isRevealed
                          ? credential.password
                          : maskedValue(credential.password.length)}
                    </span>
                    <button
                      type="button"
                      className="btn btn--icon btn--sm"
                      onClick={() => void toggleReveal(credential)}
                      aria-label={isRevealed ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                      title={isRevealed ? 'Yashirish' : 'Ko‘rsatish'}
                      disabled={credential.password.length === 0}
                    >
                      {isRevealed ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--sm"
                      onClick={() => void copy(credential.password, 'Parol', { sensitive: true })}
                      aria-label="Parolni nusxalash"
                      title="Nusxalash"
                      disabled={credential.password.length === 0}
                    >
                      <IconCopy size={14} />
                    </button>
                  </div>
                </td>

                <td data-label="Kuch">
                  <StrengthBadge password={credential.password} />
                </td>

                <td data-label="Kategoriya">
                  <span
                    className="badge badge--category"
                    style={{
                      ['--cat-hue' as string]: String(
                        categoryHue(credential.category, categories),
                      ),
                    }}
                  >
                    {categoryLabel(credential.category, categories)}
                  </span>
                </td>

                <td data-label="Yangilangan">
                  <span className="u-dim" style={{ fontSize: 'var(--text-xs)' }}>
                    {formatRelative(credential.updatedAt)}
                  </span>
                </td>

                <td data-label="">
                  <div className="table__actions">
                    <button
                      type="button"
                      className={`btn btn--icon btn--sm${credential.favorite ? ' is-active' : ''}`}
                      onClick={() => onToggleFavorite(credential)}
                      aria-label={
                        credential.favorite ? 'Sevimlilardan olish' : 'Sevimlilarga qo‘shish'
                      }
                      aria-pressed={credential.favorite}
                      title="Sevimli"
                    >
                      <IconStar size={15} filled={credential.favorite} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--sm"
                      onClick={() => onEdit(credential)}
                      aria-label="Tahrirlash"
                      title="Tahrirlash"
                    >
                      <IconEdit size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--sm"
                      onClick={() => onDelete(credential)}
                      aria-label="O‘chirish"
                      title="O‘chirish"
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
