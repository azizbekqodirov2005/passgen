/**
 * securityAudit — local analysis of the unlocked vault.
 *
 * Every check runs in the browser against in-memory data. No password, no hash
 * and no prefix of a hash is sent anywhere. PassGen therefore never claims a
 * password is "compromised" or "breached": without a breach-checking service
 * there is no evidence for such a claim, so the audit reports only what it can
 * actually prove locally — weakness, reuse, length and age.
 */

import { sha256Base64 } from '@/services/cryptoService';
import { estimateStrength } from '@/lib/strength';
import type { Credential, StrengthLevel } from '@/lib/types';

/** A credential older than this is flagged as worth rotating. */
export const STALE_AFTER_DAYS = 365;
export const SHORT_PASSWORD_LENGTH = 12;
export const LOW_ENTROPY_BITS = 50;

export type IssueKind = 'weak' | 'reused' | 'short' | 'missing' | 'stale' | 'low-entropy';

export interface AuditIssue {
  kind: IssueKind;
  credentialId: string;
  credentialName: string;
  /** Human-readable Uzbek explanation. Never contains the password itself. */
  detail: string;
}

export interface AuditEntry {
  id: string;
  name: string;
  level: StrengthLevel;
  entropy: number;
  score: number;
  length: number;
  reused: boolean;
  reuseCount: number;
  stale: boolean;
  ageDays: number;
  issues: IssueKind[];
}

export interface AuditRecommendation {
  id: string;
  title: string;
  body: string;
  severity: 'high' | 'medium' | 'low';
}

export interface AuditReport {
  total: number;
  score: number;
  strong: number;
  good: number;
  fair: number;
  weak: number;
  missing: number;
  reused: number;
  short: number;
  stale: number;
  lowEntropy: number;
  entries: AuditEntry[];
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
  /** Groups of credential ids that share one password. */
  reuseGroups: string[][];
}

function daysSince(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / 86_400_000);
}

/**
 * Group credentials that share a password. Hashing happens locally and the
 * hashes never leave this function's scope.
 */
async function findReuseGroups(credentials: Credential[]): Promise<Map<string, string[]>> {
  const byHash = new Map<string, string[]>();

  for (const credential of credentials) {
    if (credential.password.length === 0) continue;
    const hash = await sha256Base64(credential.password);
    const group = byHash.get(hash);
    if (group) {
      group.push(credential.id);
    } else {
      byHash.set(hash, [credential.id]);
    }
  }

  // Keep only the hashes that actually repeat.
  for (const [hash, ids] of byHash) {
    if (ids.length < 2) byHash.delete(hash);
  }
  return byHash;
}

export async function runSecurityAudit(credentials: Credential[]): Promise<AuditReport> {
  const reuseGroups = await findReuseGroups(credentials);
  const reusedIds = new Map<string, number>();
  for (const ids of reuseGroups.values()) {
    for (const id of ids) reusedIds.set(id, ids.length);
  }

  const entries: AuditEntry[] = [];
  const issues: AuditIssue[] = [];

  let strong = 0;
  let good = 0;
  let fair = 0;
  let weak = 0;
  let missing = 0;
  let short = 0;
  let stale = 0;
  let lowEntropy = 0;

  for (const credential of credentials) {
    const strength = estimateStrength(credential.password);
    const ageDays = daysSince(credential.updatedAt);
    const isStale = ageDays > STALE_AFTER_DAYS;
    const reuseCount = reusedIds.get(credential.id) ?? 0;
    const entryIssues: IssueKind[] = [];

    if (credential.password.length === 0) {
      missing += 1;
      entryIssues.push('missing');
      issues.push({
        kind: 'missing',
        credentialId: credential.id,
        credentialName: credential.name,
        detail: 'Yozuvda parol saqlanmagan.',
      });
    } else {
      switch (strength.level) {
        case 'strong':
          strong += 1;
          break;
        case 'good':
          good += 1;
          break;
        case 'fair':
          fair += 1;
          break;
        default:
          weak += 1;
          entryIssues.push('weak');
          issues.push({
            kind: 'weak',
            credentialId: credential.id,
            credentialName: credential.name,
            detail: `Parol kuchsiz (taxminan ${String(strength.entropy)} bit entropiya).`,
          });
          break;
      }

      if (credential.password.length < SHORT_PASSWORD_LENGTH) {
        short += 1;
        entryIssues.push('short');
        issues.push({
          kind: 'short',
          credentialId: credential.id,
          credentialName: credential.name,
          detail: `Parol ${String(credential.password.length)} belgidan iborat — ${String(SHORT_PASSWORD_LENGTH)} dan uzun bo'lishi tavsiya etiladi.`,
        });
      }

      if (strength.entropy < LOW_ENTROPY_BITS && strength.level !== 'weak') {
        lowEntropy += 1;
        entryIssues.push('low-entropy');
        issues.push({
          kind: 'low-entropy',
          credentialId: credential.id,
          credentialName: credential.name,
          detail: 'Entropiya past: belgilar xilma-xilligini oshiring.',
        });
      }
    }

    if (reuseCount > 1) {
      entryIssues.push('reused');
      issues.push({
        kind: 'reused',
        credentialId: credential.id,
        credentialName: credential.name,
        detail: `Bu parol yana ${String(reuseCount - 1)} ta yozuvda ishlatilgan.`,
      });
    }

    if (isStale) {
      stale += 1;
      entryIssues.push('stale');
      issues.push({
        kind: 'stale',
        credentialId: credential.id,
        credentialName: credential.name,
        detail: `Parol ${String(ageDays)} kundan beri yangilanmagan.`,
      });
    }

    entries.push({
      id: credential.id,
      name: credential.name,
      level: strength.level,
      entropy: strength.entropy,
      score: strength.score,
      length: credential.password.length,
      reused: reuseCount > 1,
      reuseCount,
      stale: isStale,
      ageDays,
      issues: entryIssues,
    });
  }

  const reused = reusedIds.size;
  const score = computeScore({
    total: credentials.length,
    entries,
    reused,
    missing,
    stale,
  });

  return {
    total: credentials.length,
    score,
    strong,
    good,
    fair,
    weak,
    missing,
    reused,
    short,
    stale,
    lowEntropy,
    entries: entries.sort((a, b) => a.score - b.score),
    issues,
    recommendations: buildRecommendations({ weak, reused, short, stale, missing, total: credentials.length }),
    reuseGroups: [...reuseGroups.values()],
  };
}

/**
 * Overall score: the average per-password strength, reduced by penalties for
 * reuse, missing passwords and stale credentials.
 */
function computeScore(input: {
  total: number;
  entries: AuditEntry[];
  reused: number;
  missing: number;
  stale: number;
}): number {
  if (input.total === 0) return 0;

  const average =
    input.entries.reduce((sum, entry) => sum + entry.score, 0) / input.entries.length;

  const reusePenalty = (input.reused / input.total) * 25;
  const missingPenalty = (input.missing / input.total) * 20;
  const stalePenalty = (input.stale / input.total) * 10;

  const score = average - reusePenalty - missingPenalty - stalePenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildRecommendations(input: {
  weak: number;
  reused: number;
  short: number;
  stale: number;
  missing: number;
  total: number;
}): AuditRecommendation[] {
  const recommendations: AuditRecommendation[] = [];

  if (input.total === 0) {
    return [
      {
        id: 'empty',
        title: "Omborga birinchi yozuvni qo'shing",
        body: "Hisoblaringizni qo'shganingizdan so'ng PassGen ularning xavfsizligini tahlil qila boshlaydi.",
        severity: 'low',
      },
    ];
  }

  if (input.reused > 0) {
    recommendations.push({
      id: 'reused',
      title: `${String(input.reused)} ta yozuvda takrorlangan parol bor`,
      body: "Bitta parol bir nechta saytda ishlatilsa, bitta sayt buzilganida barchasi xavf ostida qoladi. Har bir hisob uchun alohida parol yarating.",
      severity: 'high',
    });
  }
  if (input.weak > 0) {
    recommendations.push({
      id: 'weak',
      title: `${String(input.weak)} ta kuchsiz parolni yangilang`,
      body: "Generator yordamida 20 belgidan uzun, barcha belgi turlari aralash parol yaratib, eski parolni o'zgartiring.",
      severity: 'high',
    });
  }
  if (input.missing > 0) {
    recommendations.push({
      id: 'missing',
      title: `${String(input.missing)} ta yozuvda parol yo'q`,
      body: "Parolsiz yozuvlar ombordan foyda keltirmaydi — parolni kiriting yoki yozuvni o'chirib tashlang.",
      severity: 'medium',
    });
  }
  if (input.short > 0) {
    recommendations.push({
      id: 'short',
      title: `${String(input.short)} ta parol juda qisqa`,
      body: `Zamonaviy hujumlarga qarshi kamida ${String(SHORT_PASSWORD_LENGTH)} belgi kerak; 16–20 belgi yanada yaxshi.`,
      severity: 'medium',
    });
  }
  if (input.stale > 0) {
    recommendations.push({
      id: 'stale',
      title: `${String(input.stale)} ta parol bir yildan beri yangilanmagan`,
      body: "Muhim hisoblar (bank, pochta) parolini vaqti-vaqti bilan yangilab turish foydali.",
      severity: 'low',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'clean',
      title: 'Ombor yaxshi holatda',
      body: "Kuchsiz yoki takrorlangan parol topilmadi. Zaxira nusxani vaqti-vaqti bilan yangilab qo'ying.",
      severity: 'low',
    });
  }

  return recommendations;
}

export const ISSUE_LABELS: Record<IssueKind, string> = {
  weak: 'Kuchsiz',
  reused: 'Takrorlangan',
  short: 'Qisqa',
  missing: "Parol yo'q",
  stale: 'Eskirgan',
  'low-entropy': 'Past entropiya',
};
