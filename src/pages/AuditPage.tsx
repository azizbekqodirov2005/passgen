import { IconEdit, IconShield } from '@/components/icons';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { STRENGTH_COLOR_VAR } from '@/components/ui/StrengthMeter';
import { scoreColor, scoreVerdict, useAudit } from '@/hooks/useAudit';
import { ISSUE_LABELS, type IssueKind } from '@/services/securityAudit';
import { STRENGTH_LABELS } from '@/lib/strength';
import { formatRelative } from '@/lib/format';
import type { Credential } from '@/lib/types';

interface AuditPageProps {
  credentials: Credential[];
  onEdit: (credential: Credential) => void;
}

export function AuditPage({ credentials, onEdit }: AuditPageProps) {
  const { report, loading } = useAudit(credentials);
  const color = scoreColor(report.score);

  if (loading && credentials.length > 0) {
    return (
      <>
        <div className="page__head">
          <div>
            <h1 className="page__title">Xavfsizlik tahlili</h1>
            <p className="page__subtitle">Tahlil brauzeringizda bajarilmoqda…</p>
          </div>
        </div>
        <section className="card">
          <LoadingState label="Parollar tahlil qilinmoqda" />
        </section>
      </>
    );
  }

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">Xavfsizlik tahlili</h1>
          <p className="page__subtitle">
            Tahlil to‘liq shu qurilmada bajariladi — hech bir parol tashqi
            xizmatga yuborilmaydi.
          </p>
        </div>
      </div>

      {report.total === 0 ? (
        <section className="card">
          <EmptyState
            icon={<IconShield size={22} />}
            title="Tahlil qilish uchun yozuv yo‘q"
            text="Omborga hisoblarni qo‘shganingizdan keyin kuchsiz, qisqa va takrorlangan parollar shu yerda ko‘rsatiladi."
          />
        </section>
      ) : (
        <div className="u-stack">
          <section className="card">
            <div className="card__body">
              <div className="score">
                <div
                  className="score__dial"
                  style={{
                    ['--score' as string]: String(report.score),
                    ['--score-color' as string]: color,
                  }}
                  role="img"
                  aria-label={`Umumiy baho: ${String(report.score)} / 100`}
                >
                  <span className="score__number" style={{ ['--score-color' as string]: color }}>
                    {report.score}
                    <sub>/100</sub>
                  </span>
                </div>
                <div className="score__body">
                  <p className="score__verdict">{scoreVerdict(report.score, report.total)}</p>
                  <p className="score__hint">
                    Baho har bir parolning entropiyasidan, takrorlanish,
                    parolsiz yozuvlar va eskirgan parollar uchun jarimalar
                    ayirilgan holda hisoblanadi.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid--stats">
            {[
              { label: 'Kuchli', value: report.strong, color: 'var(--strength-strong)' },
              { label: 'Yaxshi', value: report.good, color: 'var(--strength-good)' },
              { label: 'O‘rtacha', value: report.fair, color: 'var(--strength-fair)' },
              { label: 'Kuchsiz', value: report.weak, color: 'var(--strength-weak)' },
              { label: 'Takrorlangan', value: report.reused, color: 'var(--warning)' },
              { label: 'Parolsiz', value: report.missing, color: 'var(--text-muted)' },
            ].map((item) => (
              <article
                key={item.label}
                className="stat"
                style={{ ['--stat-color' as string]: item.color }}
              >
                <div className="stat__value">{item.value}</div>
                <div className="stat__label u-label">{item.label}</div>
              </article>
            ))}
          </div>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Tavsiyalar</h2>
              <span className="badge">{report.recommendations.length}</span>
            </div>
            <div className="card__body card__body--flush">
              {report.recommendations.map((recommendation) => (
                <div
                  key={recommendation.id}
                  className={`recommendation recommendation--${recommendation.severity}`}
                >
                  <span className="recommendation__severity" aria-hidden="true" />
                  <div>
                    <p className="recommendation__title">{recommendation.title}</p>
                    <p className="recommendation__body">{recommendation.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Yozuvlar bo‘yicha natija</h2>
              <span className="u-dim" style={{ fontSize: 'var(--text-xs)' }}>
                Eng zaifi yuqorida
              </span>
            </div>
            <div className="card__body card__body--flush">
              <div className="table-wrap">
                <table className="table table--responsive">
                  <thead>
                    <tr>
                      <th scope="col">Yozuv</th>
                      <th scope="col">Kuch</th>
                      <th scope="col">Entropiya</th>
                      <th scope="col">Uzunlik</th>
                      <th scope="col">Muammolar</th>
                      <th scope="col">Yangilangan</th>
                      <th scope="col">
                        <span className="u-visually-hidden">Amallar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((entry) => {
                      const credential = credentials.find((item) => item.id === entry.id);
                      return (
                        <tr key={entry.id}>
                          <td data-label="Yozuv">
                            <span style={{ fontWeight: 550 }}>{entry.name}</span>
                          </td>
                          <td data-label="Kuch">
                            <span className={`badge badge--${entry.level}`}>
                              {STRENGTH_LABELS[entry.level]}
                            </span>
                          </td>
                          <td data-label="Entropiya">
                            <div style={{ minWidth: '5rem' }}>
                              <div
                                className="meter"
                                style={{
                                  ['--strength-color' as string]:
                                    STRENGTH_COLOR_VAR[entry.level],
                                }}
                              >
                                <div
                                  className="meter__fill"
                                  style={{ width: `${String(entry.score)}%` }}
                                />
                              </div>
                              <span
                                className="u-mono u-dim"
                                style={{ fontSize: 'var(--text-2xs)' }}
                              >
                                {entry.entropy} bit
                              </span>
                            </div>
                          </td>
                          <td data-label="Uzunlik">
                            <span className="u-mono">{entry.length}</span>
                          </td>
                          <td data-label="Muammolar">
                            {entry.issues.length === 0 ? (
                              <span className="u-dim">—</span>
                            ) : (
                              <span className="issue-chips">
                                {entry.issues.map((issue: IssueKind) => (
                                  <span
                                    key={issue}
                                    className={`badge${
                                      issue === 'weak' || issue === 'missing'
                                        ? ' badge--weak'
                                        : issue === 'reused' || issue === 'short'
                                          ? ' badge--fair'
                                          : ''
                                    }`}
                                  >
                                    {ISSUE_LABELS[issue]}
                                  </span>
                                ))}
                              </span>
                            )}
                          </td>
                          <td data-label="Yangilangan">
                            <span className="u-dim" style={{ fontSize: 'var(--text-xs)' }}>
                              {formatRelative(Date.now() - entry.ageDays * 86_400_000)}
                            </span>
                          </td>
                          <td data-label="">
                            <div className="table__actions">
                              {credential ? (
                                <button
                                  type="button"
                                  className="btn btn--sm"
                                  onClick={() => onEdit(credential)}
                                >
                                  <IconEdit size={14} />
                                  Tuzatish
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <div className="notice notice--info">
            <div>
              PassGen parollaringiz ommaviy ma’lumot sizishlarida uchraganini
              <strong> tekshirmaydi</strong> va shunday da’vo qilmaydi: buning
              uchun parol (yoki uning xeshi) tashqi xizmatga yuborilishi kerak
              bo‘lardi. Yuqoridagi natijalar faqat mahalliy tahlilga asoslangan.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
