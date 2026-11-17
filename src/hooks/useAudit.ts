import { useEffect, useState } from 'react';
import { runSecurityAudit, type AuditReport } from '@/services/securityAudit';
import type { Credential } from '@/lib/types';

const EMPTY_REPORT: AuditReport = {
  total: 0,
  score: 0,
  strong: 0,
  good: 0,
  fair: 0,
  weak: 0,
  missing: 0,
  reused: 0,
  short: 0,
  stale: 0,
  lowEntropy: 0,
  entries: [],
  issues: [],
  recommendations: [],
  reuseGroups: [],
};

/**
 * Recomputes the audit whenever the vault changes. The analysis hashes every
 * password, so it runs in an effect rather than during render.
 */
export function useAudit(credentials: Credential[]): { report: AuditReport; loading: boolean } {
  const [report, setReport] = useState<AuditReport>(EMPTY_REPORT);
  const [loading, setLoading] = useState(credentials.length > 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void runSecurityAudit(credentials)
      .then((result) => {
        if (!cancelled) {
          setReport(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReport(EMPTY_REPORT);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [credentials]);

  return { report, loading };
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'var(--strength-strong)';
  if (score >= 60) return 'var(--strength-good)';
  if (score >= 40) return 'var(--strength-fair)';
  return 'var(--strength-weak)';
}

export function scoreVerdict(score: number, total: number): string {
  if (total === 0) return 'Ombor hali bo‘sh';
  if (score >= 85) return 'Ombor juda yaxshi holatda';
  if (score >= 70) return 'Ombor yaxshi, kichik tuzatishlar bor';
  if (score >= 50) return 'E’tibor talab qiladigan parollar bor';
  if (score >= 30) return 'Ko‘p parol zaiflashgan';
  return 'Ombor xavfsizligi past';
}
