import { IconPlus, IconSearch, IconStar, IconVault } from '@/components/icons';
import { CredentialTable } from '@/components/vault/CredentialTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { allCategories } from '@/lib/categories';
import { countLabel } from '@/lib/format';
import { useFilteredCredentials, type FilterState } from '@/hooks/useFilteredCredentials';
import type { Credential, CustomCategory, SortKey } from '@/lib/types';

interface PasswordsPageProps {
  title: string;
  subtitle: string;
  credentials: Credential[];
  categories: CustomCategory[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onAdd: () => void;
  onEdit: (credential: Credential) => void;
  onDelete: (credential: Credential) => void;
  onToggleFavorite: (credential: Credential) => void;
  onBeforeReveal: () => Promise<boolean>;
  favoritesOnly?: boolean;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Nomi' },
  { key: 'created', label: 'Qo‘shilgan sana' },
  { key: 'updated', label: 'Yangilangan sana' },
  { key: 'security', label: 'Xavfsizlik holati' },
];

export function PasswordsPage({
  title,
  subtitle,
  credentials,
  categories,
  filters,
  onFiltersChange,
  onAdd,
  onEdit,
  onDelete,
  onToggleFavorite,
  onBeforeReveal,
  favoritesOnly = false,
}: PasswordsPageProps) {
  const effectiveFilters: FilterState = favoritesOnly
    ? { ...filters, onlyFavorites: true }
    : filters;
  const visible = useFilteredCredentials(credentials, effectiveFilters);

  const toggleSort = (key: SortKey) => {
    onFiltersChange({
      ...filters,
      sort:
        filters.sort.key === key
          ? { key, direction: filters.sort.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: 'asc' },
    });
  };

  const isFiltered =
    filters.query.length > 0 || filters.category !== 'all';

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            <IconPlus size={16} />
            Yangi yozuv
          </button>
        </div>
      </div>

      <section className="card">
        <div className="card__head">
          <div className="u-row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <span className="badge">{countLabel(visible.length, 'yozuv')}</span>

            <label className="u-row">
              <span className="u-label">Kategoriya</span>
              <select
                className="select select--inline"
                value={filters.category}
                onChange={(event) =>
                  onFiltersChange({ ...filters, category: event.target.value })
                }
                aria-label="Kategoriya bo‘yicha filtr"
              >
                <option value="all">Barchasi</option>
                {allCategories(categories).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="u-row">
              <span className="u-label">Saralash</span>
              <select
                className="select select--inline"
                value={filters.sort.key}
                onChange={(event) => toggleSort(event.target.value as SortKey)}
                aria-label="Saralash tartibi"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn--sm"
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  sort: {
                    ...filters.sort,
                    direction: filters.sort.direction === 'asc' ? 'desc' : 'asc',
                  },
                })
              }
            >
              {filters.sort.direction === 'asc' ? 'O‘sish bo‘yicha' : 'Kamayish bo‘yicha'}
            </button>
          </div>

          {isFiltered ? (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() =>
                onFiltersChange({ ...filters, query: '', category: 'all' })
              }
            >
              Filtrlarni tozalash
            </button>
          ) : null}
        </div>

        <div className="card__body card__body--flush">
          {visible.length === 0 ? (
            isFiltered ? (
              <EmptyState
                icon={<IconSearch size={22} />}
                title="Hech narsa topilmadi"
                text="Qidiruv so‘zini qisqartiring yoki kategoriya filtrini o‘zgartiring. Qidiruv parol va izoh matnini qamramaydi."
              />
            ) : favoritesOnly ? (
              <EmptyState
                icon={<IconStar size={22} />}
                title="Sevimlilar bo‘sh"
                text="Yozuv yonidagi yulduzchani bosib, tez-tez ishlatadigan hisoblarni bu bo‘limga qo‘shing."
              />
            ) : (
              <EmptyState
                icon={<IconVault size={22} />}
                title="Omborda hali yozuv yo‘q"
                text="Hisoblaringizni qo‘shing yoki generator yordamida yangi parol yaratib, darhol saqlang."
                action={
                  <button type="button" className="btn btn--primary" onClick={onAdd}>
                    <IconPlus size={16} />
                    Birinchi yozuvni qo‘shish
                  </button>
                }
              />
            )
          ) : (
            <CredentialTable
              credentials={visible}
              categories={categories}
              sort={filters.sort}
              onSortChange={toggleSort}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onBeforeReveal={onBeforeReveal}
            />
          )}
        </div>
      </section>
    </>
  );
}
