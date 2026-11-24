export type User = {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: number;
};

export const DEFAULT_DISPLAY_NAME = 'Atleta';

/** Deriva um nome de exibição a partir do e-mail ("joao.silva@x.com" → "Joao Silva"). */
export function displayNameFromEmail(email: string | null | undefined): string {
  const local = email?.trim().split('@')[0];
  if (!local) return DEFAULT_DISPLAY_NAME;
  const name = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
  return name || DEFAULT_DISPLAY_NAME;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}
