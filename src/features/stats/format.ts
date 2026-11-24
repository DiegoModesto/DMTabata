import { DIFFICULTY_LABELS, MOOD_LABELS, type SessionRecord } from '@/domain/stats';

const pad = (n: number) => n.toString().padStart(2, '0');

/** dd/mm — formatação manual para não depender do Intl do dispositivo. */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${formatDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const formatPercent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
export const formatAverage = (v: number | null, digits = 1) =>
  v === null ? '—' : v.toFixed(digits).replace('.', ',');

export const statusLabel = (s: SessionRecord) =>
  s.status === 'completed' ? 'Concluído' : s.status === 'abandoned' ? 'Interrompido' : 'Em andamento';

export function feedbackLine(s: SessionRecord): string | null {
  const f = s.feedback;
  if (!f) return null;
  const parts = [
    f.rating ? '★'.repeat(f.rating) : null,
    f.rpe ? `Esforço ${f.rpe}/10` : null,
    f.difficulty ? DIFFICULTY_LABELS[f.difficulty] : null,
    f.mood ? MOOD_LABELS[f.mood] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
