/**
 * Hash-based routing. A hash router needs no server rewrite rules, so the
 * production build works unchanged on GitHub Pages, Netlify or a plain folder.
 */

import { useCallback, useEffect, useState } from 'react';

export const ROUTES = [
  'dashboard',
  'passwords',
  'favorites',
  'generator',
  'audit',
  'categories',
  'settings',
] as const;

export type Route = (typeof ROUTES)[number];

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/u, '').split('?')[0] ?? '';
  return (ROUTES as readonly string[]).includes(raw) ? (raw as Route) : 'dashboard';
}

export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? 'dashboard' : parseHash(),
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    if (window.location.hash === '') {
      window.location.replace('#/dashboard');
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.location.hash = `#/${next}`;
    setRoute(next);
    // A route change should start at the top of the new page.
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return [route, navigate];
}

export const ROUTE_TITLES: Record<Route, string> = {
  dashboard: 'Boshqaruv paneli',
  passwords: 'Barcha parollar',
  favorites: 'Sevimlilar',
  generator: 'Parol generatori',
  audit: 'Xavfsizlik tahlili',
  categories: 'Kategoriyalar',
  settings: 'Sozlamalar',
};
