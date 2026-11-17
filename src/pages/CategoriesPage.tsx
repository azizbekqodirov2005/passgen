import { useState } from 'react';
import { IconPlus, IconTag, IconTrash } from '@/components/icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BUILT_IN_CATEGORIES, categoryHue, toCategoryId } from '@/lib/categories';
import { countLabel } from '@/lib/format';
import { useToast } from '@/state/ToastProvider';
import type { Credential, CustomCategory } from '@/lib/types';

interface CategoriesPageProps {
  credentials: Credential[];
  categories: CustomCategory[];
  onSave: (categories: CustomCategory[]) => Promise<void>;
  onOpenCategory: (categoryId: string) => void;
}

export function CategoriesPage({
  credentials,
  categories,
  onSave,
  onOpenCategory,
}: CategoriesPageProps) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CustomCategory | null>(null);

  const countFor = (id: string) =>
    credentials.filter((credential) => credential.category === id).length;

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    if (trimmed.length === 0) return;

    const id = toCategoryId(trimmed);
    const exists =
      categories.some((category) => category.id === id) ||
      BUILT_IN_CATEGORIES.some(
        (category) => category.label.toLowerCase() === trimmed.toLowerCase(),
      );
    if (exists) {
      toast.error('Bu kategoriya allaqachon mavjud');
      return;
    }

    await onSave([...categories, { id, label: trimmed }]);
    setLabel('');
    toast.success(`"${trimmed}" kategoriyasi qo‘shildi`);
  };

  const remove = async (category: CustomCategory) => {
    await onSave(categories.filter((item) => item.id !== category.id));
    setPendingDelete(null);
    toast.success(
      `"${category.label}" o‘chirildi`,
      'Unga tegishli yozuvlar "Boshqa" kategoriyasida ko‘rinadi.',
    );
  };

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">Kategoriyalar</h1>
          <p className="page__subtitle">
            Maxsus kategoriya nomlari ham ombor kaliti bilan shifrlab saqlanadi.
          </p>
        </div>
      </div>

      <div className="u-stack">
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Standart kategoriyalar</h2>
            <span className="badge">{BUILT_IN_CATEGORIES.length}</span>
          </div>
          <div className="card__body card__body--flush">
            <ul>
              {BUILT_IN_CATEGORIES.map((category) => (
                <li key={category.id} className="variation">
                  <span
                    className="badge badge--category"
                    style={{ ['--cat-hue' as string]: String(category.hue) }}
                  >
                    {category.label}
                  </span>
                  <span className="u-spacer" />
                  <span className="u-dim" style={{ fontSize: 'var(--text-xs)' }}>
                    {countLabel(countFor(category.id), 'yozuv')}
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => onOpenCategory(category.id)}
                    disabled={countFor(category.id) === 0}
                  >
                    Ko‘rish
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Maxsus kategoriyalar</h2>
            <span className="badge">{categories.length}</span>
          </div>
          <div className="card__body u-stack">
            <form className="input-group" onSubmit={(event) => void add(event)}>
              <input
                className="input"
                value={label}
                maxLength={40}
                placeholder="Yangi kategoriya nomi"
                aria-label="Yangi kategoriya nomi"
                onChange={(event) => setLabel(event.target.value)}
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={label.trim().length === 0}
              >
                <IconPlus size={16} />
                Qo‘shish
              </button>
            </form>

            {categories.length === 0 ? (
              <div className="empty" style={{ padding: 'var(--space-6) 0' }}>
                <div className="empty__art">
                  <IconTag size={20} />
                </div>
                <p className="empty__text">
                  Hali maxsus kategoriya yo‘q. Masalan "Mijozlar", "Hosting" yoki
                  "Universitet" kabi nom qo‘shishingiz mumkin.
                </p>
              </div>
            ) : (
              <ul>
                {categories.map((category) => (
                  <li key={category.id} className="variation">
                    <span
                      className="badge badge--category"
                      style={{
                        ['--cat-hue' as string]: String(categoryHue(category.id, categories)),
                      }}
                    >
                      {category.label}
                    </span>
                    <span className="u-spacer" />
                    <span className="u-dim" style={{ fontSize: 'var(--text-xs)' }}>
                      {countLabel(countFor(category.id), 'yozuv')}
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => onOpenCategory(category.id)}
                      disabled={countFor(category.id) === 0}
                    >
                      Ko‘rish
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--sm"
                      onClick={() => setPendingDelete(category)}
                      aria-label={`${category.label} kategoriyasini o‘chirish`}
                    >
                      <IconTrash size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {pendingDelete ? (
        <ConfirmDialog
          title="Kategoriyani o‘chirish"
          description={`"${pendingDelete.label}" kategoriyasi o‘chiriladi.`}
          confirmLabel="O‘chirish"
          tone="danger"
          body={
            <div className="notice notice--info">
              <div>
                Yozuvlar o‘chirilmaydi. {countLabel(countFor(pendingDelete.id), 'yozuv')} bundan
                keyin "Boshqa" kategoriyasida ko‘rinadi.
              </div>
            </div>
          }
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  );
}
