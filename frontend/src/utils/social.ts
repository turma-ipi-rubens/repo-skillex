/** Plataformas de redes sociais que o usuário pode vincular ao perfil. */

export interface SocialLink {
  platform: string;
  url: string;
}

/** Mantém a mesma lista do backend (SOCIAL_PLATFORMS em utils/constants.ts). */
export const SOCIAL_PLATFORMS = [
  'INSTAGRAM',
  'LINKEDIN',
  'GITHUB',
  'TWITTER',
  'YOUTUBE',
  'FACEBOOK',
  'TIKTOK',
  'WEBSITE',
] as const;

export const SOCIAL_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  GITHUB: 'GitHub',
  TWITTER: 'X (Twitter)',
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  WEBSITE: 'Site',
};

/** Ícone do Bootstrap Icons correspondente a cada plataforma. */
export const SOCIAL_ICONS: Record<string, string> = {
  INSTAGRAM: 'instagram',
  LINKEDIN: 'linkedin',
  GITHUB: 'github',
  TWITTER: 'twitter-x',
  YOUTUBE: 'youtube',
  FACEBOOK: 'facebook',
  TIKTOK: 'tiktok',
  WEBSITE: 'link-45deg',
};

export function socialIcon(platform: string): string {
  return SOCIAL_ICONS[platform] ?? 'link-45deg';
}

export function socialLabel(platform: string): string {
  return SOCIAL_LABELS[platform] ?? platform;
}
