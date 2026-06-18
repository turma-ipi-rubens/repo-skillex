/** Avatar do usuário: foto quando existe, senão as iniciais do nome. */
import { useEffect, useState } from 'react';

export interface AvatarUser {
  name?: string | null;
  avatarUrl?: string | null;
}

export function Avatar({
  user,
  size = 'md',
}: {
  user: AvatarUser | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls = `avatar avatar--${size}`;
  const avatarUrl = user?.avatarUrl ?? null;
  const [failed, setFailed] = useState(false);

  // Reseta o flag de erro quando a URL muda — uma nova foto subida deve
  // ter uma chance fresca de carregar mesmo se a anterior falhou.
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const initials = (user?.name || '?')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0] || '')
    .join('')
    .toUpperCase();

  if (avatarUrl && !failed) {
    return (
      <img
        className={cls}
        src={avatarUrl}
        alt={user?.name ?? ''}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return <div className={cls}>{initials}</div>;
}
