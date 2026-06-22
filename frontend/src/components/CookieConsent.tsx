/** Aviso de cookies exibido na landing page até o usuário aceitar. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';

const STORAGE_KEY = 'skillex.cookieConsent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'accepted') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // ignore: storage indisponível (modo privado, etc.)
    }
    setVisible(false);
  };

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Aviso de cookies">
      <div className="cookie-banner__inner">
        <div className="cookie-banner__icon" aria-hidden="true">
          <Icon name="cookie" />
        </div>
        <div className="cookie-banner__text">
          <strong>Este site usa cookies</strong>
          <p>
            Utilizamos cookies para melhorar sua experiência, manter você conectado e analisar o uso
            da plataforma. Saiba mais na nossa <Link to="/privacy">Política de Privacidade</Link>.
          </p>
        </div>
        <button type="button" className="btn btn--primary cookie-banner__accept" onClick={accept}>
          Aceitar
        </button>
      </div>
    </div>
  );
}
