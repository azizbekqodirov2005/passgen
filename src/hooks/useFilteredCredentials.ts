import { useMemo } from 'react';
import { estimateStrength } from '@/lib/strength';
import { hostFromUrl } from '@/lib/format';
import type { Credential, SortDirection, SortKey } from '@/lib/types';

export interface FilterState {
  query: string;
  category: string | 'all';
  onlyFavorites: boolean;
  sort: { key: SortKey; direction: SortDirection };
}

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  category: 'all',
  onlyFavorites: false,
  sort: { key: 'name', direction: 'asc' },
};

function matches(credential: Credential, query: string): boolean {
  if (query.length === 0) return true;
  const needle = query.trim().toLowerCase();
  // Deliberately does not search the password or notes: typing a few
  // characters should not confirm what a stored password starts with.
  return (
    credential.name.toLowerCase().includes(needle) ||
    credential.username.toLowerCase().includes(needle) ||
    credential.url.toLowerCase().includes(needle) ||
    hostFromUrl(credential.url).toLowerCase().includes(needle)
  );
}

function compare(a: Credential, b: Credential, key: SortKey): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name, 'uz');
    case 'created':
      return a.createdAt - b.createdAt;
    case 'updated':
      return a.updatedAt - b.updatedAt;
    case 'security':
      return estimateStrength(a.password).score - estimateStrength(b.password).score;
    default:
      return 0;
  }
}

export function useFilteredCredentials(
  credentials: Credential[],
  filters: FilterState,
): Credential[] {
  return useMemo(() => {
    const filtered = credentials.filter(
      (credential) =>
        matches(credential, filters.query) &&
        (filters.category === 'all' || credential.category === filters.category) &&
        (!filters.onlyFavorites || credential.favorite),
    );

    const sorted = [...filtered].sort((a, b) => compare(a, b, filters.sort.key));
    return filters.sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [credentials, filters]);
}
