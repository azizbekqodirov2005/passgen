import { AzbekDevLogo } from '@/components/layout/Logo';
import { IconExternal, IconShield } from '@/components/icons';

/**
 * Footer. The maker's logo sits on the left, separated from the product note
 * by a hairline rule, so it reads as an authored credit rather than an
 * afterthought pinned to a corner.
 */
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__brand">
        <a
          className="footer__logo-link"
          href="https://azbek.uz"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="AzbekDev — azbek.uz"
        >
          <AzbekDevLogo size={28} />
        </a>
        <span className="footer__divider" aria-hidden="true" />
        <span className="footer__maker">
          <span className="footer__maker-label">Ishlab chiquvchi</span>
          <span>
            <a href="https://azbek.uz" target="_blank" rel="noreferrer noopener">
              Azizbek Qodirov
            </a>{' '}
            · PassGen v1.0
          </span>
        </span>
      </div>

      <div className="footer__links">
        <span className="u-row u-dim">
          <IconShield size={14} />
          Barcha shifrlash brauzeringizda bajariladi
        </span>
        <a href="https://t.me/QodirovAzizbek" target="_blank" rel="noreferrer noopener">
          <span className="u-row">
            Telegram
            <IconExternal size={12} />
          </span>
        </a>
      </div>
    </footer>
  );
}
