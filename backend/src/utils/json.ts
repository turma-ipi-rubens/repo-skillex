/**
 * Utilitários para lidar com campos que armazenam listas em formato JSON
 * dentro do SQLite (que não possui tipo array nativo).
 */

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function stringifyArray(value: string[] | null | undefined): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

/** Link de rede social vinculado ao perfil (ex.: Instagram, GitHub). */
export interface SocialLink {
  platform: string;
  url: string;
}

export function parseSocialLinks(value: string | null | undefined): SocialLink[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.platform === 'string' && typeof l.url === 'string')
      .map((l) => ({ platform: String(l.platform), url: String(l.url) }));
  } catch {
    return [];
  }
}

export function stringifySocialLinks(value: SocialLink[] | null | undefined): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}
