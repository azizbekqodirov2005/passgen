import { PassGenMark } from '@/components/layout/Logo';
import {
  IconClose,
  IconDashboard,
  IconKey,
  IconLock,
  IconMoon,
  IconSettings,
  IconShield,
  IconStar,
  IconSun,
  IconTag,
  IconVault,
} from '@/components/icons';
import { ROUTE_TITLES, type Route } from '@/hooks/useRoute';
import { useTheme } from '@/state/ThemeProvider';

interface SidebarProps {
  route: Route;
  onNavigate: (route: Route) => void;
  counts: { all: number; favorites: number; categories: number };
  score: number | null;
  open: boolean;
  onClose: () => void;
  onLock: () => void;
}

const PRIMARY: { route: Route; icon: typeof IconDashboard }[] = [
  { route: 'dashboard', icon: IconDashboard },
  { route: 'passwords', icon: IconVault },
  { route: 'favorites', icon: IconStar },
];

const TOOLS: { route: Route; icon: typeof IconDashboard }[] = [
  { route: 'generator', icon: IconKey },
  { route: 'audit', icon: IconShield },
  { route: 'categories', icon: IconTag },
];

export function Sidebar({
  route,
  onNavigate,
  counts,
  score,
  open,
  onClose,
  onLock,
}: SidebarProps) {
  const { resolved, toggle } = useTheme();

  const countFor = (target: Route): number | null => {
    if (target === 'passwords') return counts.all;
    if (target === 'favorites') return counts.favorites;
    if (target === 'categories') return counts.categories;
    if (target === 'audit') return score;
    return null;
  };

  const renderItem = ({ route: target, icon: Icon }: { route: Route; icon: typeof IconDashboard }) => {
    const count = countFor(target);
    return (
      <li key={target}>
        <button
          type="button"
          className={`nav-item${route === target ? ' is-active' : ''}`}
          onClick={() => {
            onNavigate(target);
            onClose();
          }}
          aria-current={route === target ? 'page' : undefined}
        >
          <Icon size={17} className="nav-item__icon" />
          <span className="u-truncate">{ROUTE_TITLES[target]}</span>
          {count !== null ? <span className="nav-item__count">{count}</span> : null}
        </button>
      </li>
    );
  };

  return (
    <nav className={`sidebar${open ? ' is-open' : ''}`} aria-label="Asosiy menyu">
      <div className="sidebar__brand">
        <PassGenMark />
        <span className="sidebar__brand-text">
          <span className="sidebar__brand-name">PassGen</span>
          <span className="sidebar__brand-tag">Parol ombori</span>
        </span>
        <span className="u-spacer" />
        <button
          type="button"
          className="btn btn--icon topbar__menu"
          onClick={onClose}
          aria-label="Menyuni yopish"
        >
          <IconClose size={16} />
        </button>
      </div>

      <div className="sidebar__group">
        <span className="u-label sidebar__group-label">Ombor</span>
        <ul>{PRIMARY.map(renderItem)}</ul>
      </div>

      <div className="sidebar__group">
        <span className="u-label sidebar__group-label">Vositalar</span>
        <ul>{TOOLS.map(renderItem)}</ul>
      </div>

      <div className="sidebar__footer">
        <ul>
          {renderItem({ route: 'settings', icon: IconSettings })}
          <li>
            <button type="button" className="nav-item" onClick={toggle}>
              {resolved === 'dark' ? (
                <IconSun size={17} className="nav-item__icon" />
              ) : (
                <IconMoon size={17} className="nav-item__icon" />
              )}
              <span>{resolved === 'dark' ? 'Yorug‘ rejim' : 'Tungi rejim'}</span>
            </button>
          </li>
        </ul>
        <button type="button" className="btn btn--block" onClick={onLock}>
          <IconLock size={15} />
          Omborni qulflash
        </button>
      </div>
    </nav>
  );
}
