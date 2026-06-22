import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsent } from '../../src/components/CookieConsent';

const STORAGE_KEY = 'skillex.cookieConsent';

function renderBanner() {
  return render(
    <MemoryRouter>
      <CookieConsent />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('CookieConsent', () => {
  it('exibe o aviso quando ainda não foi aceito', () => {
    renderBanner();
    expect(screen.getByRole('dialog', { name: /cookies/i })).toBeInTheDocument();
  });

  it('não exibe quando o consentimento já foi dado', () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    renderBanner();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('aceitar persiste o consentimento e esconde o aviso', () => {
    renderBanner();
    fireEvent.click(screen.getByText('Aceitar'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('exibe o aviso mesmo quando o localStorage falha na leitura', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage indisponível');
    });
    renderBanner();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('aceitar não quebra quando o localStorage falha na escrita', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage indisponível');
    });
    renderBanner();
    fireEvent.click(screen.getByText('Aceitar'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
