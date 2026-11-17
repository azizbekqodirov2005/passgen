import {
  IconAlert,
  IconClock,
  IconKey,
  IconPlus,
  IconShield,
  IconStar,
  IconVault,
} from '@/components/icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { StrengthBadge } from '@/components/ui/StrengthMeter';
import { scoreColor, scoreVerdict, useAudit } from '@/hooks/useAudit';
import { categoryLabel } from '@/lib/categories';
import { formatRelative } from '@/lib/format';
import type { Credential, CustomCategory } from '@/lib/types';
import type { ActivityEntry } from '@/lib/types';
import type { Route } from '@/hooks/useRoute';

interface DashboardPageProps {
  credentials: Credential[];
  categories: CustomCategory[];
  activity: ActivityEntry[];
  onNavigate: (route: Route) => void;
  onAdd: () => void;
  onEdit: (credential: Credential) => void;
}

export function DashboardPage({
  credentials,
  categories,
  activity,
  onNavigate,
  onAdd,
  onEdit,
}: DashboardPageProps) {
  const { report } = useAudit(credentials);

  const recent = [...credentials]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
  const favorites = credentials.filter((credential) => credential.favorite).slice(0, 5);

  const color = scoreColor(report.score);
  const total = report.total;

  const distribution = [
    { key: 'strong', count: report.strong, color: 'var(--strength-strong)', label: 'Kuchli' },
    { key: 'good', count: report.good, color: 'var(--strength-good)', label: 'Yaxshi' },
    { key: 'fair', count: report.fair, color: 'var(--strength-fair)', label: 'O‘rtacha' },
    { key: 'weak', count: report.weak, color: 'var(--strength-weak)', label: 'Kuchsiz' },
  ];

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">Boshqaruv paneli</h1>
          <p className="page__subtitle">
            Barcha ko‘rsatkichlar ombordagi haqiqiy yozuvlardan hisoblangan.
          </p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn" onClick={() => onNavigate('generator')}>
            <IconKey size={16} />
            Parol yaratish
          </button>
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            <IconPlus size={16} />
            Yangi yozuv
          </button>
        </div>
      </div>

      <div className="u-stack">
        <div className="grid grid--stats">
          <article className="stat">
            <div className="stat__value">{total}</div>
            <div className="stat__label u-label">Jami hisoblar</div>
            <div className="stat__meta">
              {categories.length > 0
                ? `${String(categories.length)} maxsus kategoriya`
                : 'Standart kategoriyalar'}
            </div>
          </article>

          <article className="stat" style={{ ['--stat-color' as string]: 'var(--strength-strong)' }}>
            <div className="stat__value">{report.strong}</div>
            <div className="stat__label u-label">Kuchli parollar</div>
            <div className="stat__meta">80 bit va undan yuqori entropiya</div>
          </article>

          <article className="stat" style={{ ['--stat-color' as string]: 'var(--strength-weak)' }}>
            <div className="stat__value">{report.weak}</div>
            <div className="stat__label u-label">Kuchsiz parollar</div>
            <div className="stat__meta">Almashtirish tavsiya etiladi</div>
          </article>

          <article className="stat" style={{ ['--stat-color' as string]: 'var(--warning)' }}>
            <div className="stat__value">{report.reused}</div>
            <div className="stat__label u-label">Takrorlangan</div>
            <div className="stat__meta">Bir xil paroldan foydalangan yozuvlar</div>
          </article>
        </div>

        <div className="grid grid--split">
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Xavfsizlik holati</h2>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => onNavigate('audit')}
              >
                <IconShield size={14} />
                Batafsil tahlil
              </button>
            </div>
            <div className="card__body">
              <div className="score">
                <div
                  className="score__dial"
                  style={{
                    ['--score' as string]: String(report.score),
                    ['--score-color' as string]: color,
                  }}
                  role="img"
                  aria-label={`Xavfsizlik bahosi: ${String(report.score)} / 100`}
                >
                  <span
                    className="score__number"
                    style={{ ['--score-color' as string]: color }}
                  >
                    {report.score}
                    <sub>/100</sub>
                  </span>
                </div>
                <div className="score__body">
                  <p className="score__verdict">{scoreVerdict(report.score, total)}</p>
                  <p className="score__hint">
                    {total === 0
                      ? 'Birinchi yozuvni qo‘shganingizdan keyin tahlil boshlanadi.'
                      : report.recommendations[0]?.body}
                  </p>

                  <div className="distribution" aria-hidden="true">
                    {distribution.map((part) =>
                      part.count > 0 ? (
                        <span
                          key={part.key}
                          className="distribution__part"
                          style={{
                            width: `${String((part.count / Math.max(total, 1)) * 100)}%`,
                            background: part.color,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                  <div className="distribution__legend">
                    {distribution.map((part) => (
                      <span key={part.key} className="legend-item">
                        <span
                          className="legend-item__swatch"
                          style={{ background: part.color }}
                        />
                        {part.label}
                        <span className="u-mono u-dim">{part.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">So‘nggi harakatlar</h2>
            </div>
            <div className="card__body card__body--flush">
              {activity.length === 0 ? (
                <div className="empty" style={{ padding: 'var(--space-8) var(--space-5)' }}>
                  <p className="empty__text">
                    Bu sessiyada hali harakat qayd etilmagan. Jurnal faqat
                    xotirada saqlanadi va ombor qulflanganda tozalanadi.
                  </p>
                </div>
              ) : (
                <ul>
                  {activity.slice(0, 7).map((entry) => (
                    <li key={entry.id} className="variation">
                      <IconClock size={14} className="u-dim" />
                      <span className="variation__value" style={{ fontFamily: 'inherit' }}>
                        {entry.label}
                      </span>
                      <span className="u-dim" style={{ fontSize: 'var(--text-xs)' }}>
                        {formatRelative(entry.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="grid grid--halves">
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Oxirgi qo‘shilganlar</h2>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => onNavigate('passwords')}
              >
                Barchasi
              </button>
            </div>
            <div className="card__body card__body--flush">
              {recent.length === 0 ? (
                <EmptyState
                  icon={<IconVault size={22} />}
                  title="Ombor bo‘sh"
                  text="Birinchi hisobni qo‘shing — u saqlanishdan oldin shifrlanadi."
                  action={
                    <button type="button" className="btn btn--primary" onClick={onAdd}>
                      <IconPlus size={16} />
                      Yozuv qo‘shish
                    </button>
                  }
                />
              ) : (
                <ul>
                  {recent.map((credential) => (
                    <li key={credential.id} className="variation">
                      <button
                        type="button"
                        className="entry__name-button u-truncate"
                        style={{ flex: 1 }}
                        onClick={() => onEdit(credential)}
                      >
                        {credential.name}
                      </button>
                      <span className="u-dim" style={{ fontSize: 'var(--text-xs)' }}>
                        {categoryLabel(credential.category, categories)}
                      </span>
                      <StrengthBadge password={credential.password} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Sevimli hisoblar</h2>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => onNavigate('favorites')}
              >
                Barchasi
              </button>
            </div>
            <div className="card__body card__body--flush">
              {favorites.length === 0 ? (
                <div className="empty" style={{ padding: 'var(--space-8) var(--space-5)' }}>
                  <div className="empty__art">
                    <IconStar size={20} />
                  </div>
                  <p className="empty__text">
                    Tez-tez ishlatadigan hisoblarni yulduzcha bilan belgilang —
                    ular shu yerda chiqadi.
                  </p>
                </div>
              ) : (
                <ul>
                  {favorites.map((credential) => (
                    <li key={credential.id} className="variation">
                      <IconStar size={14} filled className="is-active" />
                      <button
                        type="button"
                        className="entry__name-button u-truncate"
                        style={{ flex: 1 }}
                        onClick={() => onEdit(credential)}
                      >
                        {credential.name}
                      </button>
                      <span className="u-dim" style={{ fontSize: 'var(--text-xs)' }}>
                        {credential.username || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {report.weak + report.reused > 0 ? (
          <div className="notice notice--warning">
            <IconAlert size={16} />
            <div>
              <strong>
                {report.weak} kuchsiz, {report.reused} takrorlangan parol topildi.
              </strong>{' '}
              Xavfsizlik tahlili bo‘limida qaysi yozuvlarni yangilash kerakligini
              ko‘rishingiz mumkin.
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
