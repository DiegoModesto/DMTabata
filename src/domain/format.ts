/** 75 → "1:15"; 3725 → "1:02:05". Para o relógio do temporizador. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 220 → "3min40s"; 60 → "1min"; 45 → "45s"; 3725 → "1h02min05s". Para resumos. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s === 0) return '0s';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(h ? `${m.toString().padStart(2, '0')}min` : `${m}min`);
  if (sec) parts.push(h || m ? `${sec.toString().padStart(2, '0')}s` : `${sec}s`);
  return parts.join('');
}

/** Converte milissegundos restantes em segundos exibidos (arredonda para cima: 2.1s → 3). */
export const msToDisplaySeconds = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));
