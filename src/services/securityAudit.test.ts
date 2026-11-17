import { describe, expect, it } from 'vitest';
import { runSecurityAudit } from './securityAudit';
import type { Credential } from '@/lib/types';

const DAY = 86_400_000;

function credential(partial: Partial<Credential> & { id: string; password: string }): Credential {
  return {
    name: `Hisob ${partial.id}`,
    username: 'user@example.com',
    url: '',
    category: 'other',
    notes: '',
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  };
}

describe('runSecurityAudit', () => {
  it('handles an empty vault', async () => {
    const report = await runSecurityAudit([]);
    expect(report.total).toBe(0);
    expect(report.score).toBe(0);
    expect(report.recommendations[0]?.id).toBe('empty');
  });

  it('counts strong and weak passwords', async () => {
    const report = await runSecurityAudit([
      credential({ id: '1', password: 'r8#Kp2$wQz!7mTv4Lx9B' }),
      credential({ id: '2', password: '123456' }),
      credential({ id: '3', password: 'qwerty' }),
    ]);
    expect(report.strong).toBe(1);
    expect(report.weak).toBe(2);
  });

  it('detects reused passwords and groups them', async () => {
    const report = await runSecurityAudit([
      credential({ id: '1', password: 'Takrorlangan-1!x' }),
      credential({ id: '2', password: 'Takrorlangan-1!x' }),
      credential({ id: '3', password: 'Takrorlangan-1!x' }),
      credential({ id: '4', password: 'Yakka-parol-2!xyz' }),
    ]);
    expect(report.reused).toBe(3);
    expect(report.reuseGroups).toHaveLength(1);
    expect(report.reuseGroups[0]).toHaveLength(3);
    expect(report.entries.find((e) => e.id === '4')?.reused).toBe(false);
  });

  it('flags missing, short and stale credentials', async () => {
    const report = await runSecurityAudit([
      credential({ id: 'missing', password: '' }),
      credential({ id: 'short', password: 'Ab3$x' }),
      credential({
        id: 'stale',
        password: 'r8#Kp2$wQz!7mTv4Lx9B',
        updatedAt: Date.now() - 400 * DAY,
      }),
    ]);
    expect(report.missing).toBe(1);
    expect(report.short).toBe(1);
    expect(report.stale).toBe(1);
    expect(report.issues.map((issue) => issue.kind)).toContain('missing');
    expect(report.issues.map((issue) => issue.kind)).toContain('stale');
  });

  it('never includes a password in the report', async () => {
    const secret = 'Juda-Maxfiy-Parol-9!';
    const report = await runSecurityAudit([
      credential({ id: '1', password: secret }),
      credential({ id: '2', password: secret }),
    ]);
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(JSON.stringify(report)).not.toContain('Maxfiy');
  });

  it('scores a healthy vault high and a broken one low', async () => {
    const healthy = await runSecurityAudit([
      credential({ id: '1', password: 'r8#Kp2$wQz!7mTv4Lx9B' }),
      credential({ id: '2', password: 'Zq4!tNv8@eHk3%uJd7Y' }),
    ]);
    const broken = await runSecurityAudit([
      credential({ id: '1', password: '123456' }),
      credential({ id: '2', password: '123456' }),
      credential({ id: '3', password: '' }),
    ]);
    expect(healthy.score).toBeGreaterThan(70);
    expect(broken.score).toBeLessThan(20);
    expect(broken.score).toBeGreaterThanOrEqual(0);
  });

  it('sorts entries so the riskiest come first', async () => {
    const report = await runSecurityAudit([
      credential({ id: 'strong', password: 'r8#Kp2$wQz!7mTv4Lx9B' }),
      credential({ id: 'weak', password: 'parol' }),
    ]);
    expect(report.entries[0]?.id).toBe('weak');
  });

  it('builds recommendations ordered by severity', async () => {
    const report = await runSecurityAudit([
      credential({ id: '1', password: '123456' }),
      credential({ id: '2', password: '123456' }),
    ]);
    expect(report.recommendations[0]?.severity).toBe('high');
    expect(report.recommendations.map((r) => r.id)).toContain('reused');
  });
});
