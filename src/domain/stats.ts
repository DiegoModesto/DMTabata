/**
 * Agregações de estatísticas (funções puras sobre sessões já carregadas).
 */
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';
export type Difficulty = 'facil' | 'ideal' | 'dificil';
export type Mood = 'cansado' | 'normal' | 'otimo';

export type Feedback = {
  rating: number | null;
  rpe: number | null;
  difficulty: Difficulty | null;
  mood: Mood | null;
  notes: string | null;
};

export type SessionRecord = {
  id: string;
  workoutId: string | null;
  workoutName: string;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  plannedSec: number;
  workSec: number;
  restSec: number;
  pausedSec: number;
  phasesCompleted: number;
  phasesSkipped: number;
  phasesTotal: number;
  /** Rounds contados manualmente (AMRAP). */
  roundsDone: number | null;
  feedback: Feedback | null;
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil',
  ideal: 'Ideal',
  dificil: 'Difícil',
};

export const MOOD_LABELS: Record<Mood, string> = {
  cansado: 'Cansado',
  normal: 'Normal',
  otimo: 'Ótimo',
};

export const FEEDBACK_LIMITS = { rating: [1, 5], rpe: [1, 10], notesMaxLength: 500 } as const;

export function validateFeedback(feedback: Feedback): string[] {
  const errors: string[] = [];
  const inRange = (v: number | null, [min, max]: readonly [number, number]) =>
    v === null || (Number.isInteger(v) && v >= min && v <= max);
  if (!inRange(feedback.rating, FEEDBACK_LIMITS.rating)) errors.push('Nota deve ser de 1 a 5.');
  if (!inRange(feedback.rpe, FEEDBACK_LIMITS.rpe)) errors.push('Esforço deve ser de 1 a 10.');
  if ((feedback.notes?.length ?? 0) > FEEDBACK_LIMITS.notesMaxLength)
    errors.push(`Observações com no máximo ${FEEDBACK_LIMITS.notesMaxLength} caracteres.`);
  return errors;
}

export const isFeedbackEmpty = (f: Feedback) =>
  f.rating === null && f.rpe === null && f.difficulty === null && f.mood === null && !f.notes?.trim();

// ---------- Período ----------

export type Period = '7d' | '30d' | '90d' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  all: 'Tudo',
};

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** Início do período (meia-noite local de N-1 dias atrás), ou null para "tudo". */
export function periodStart(period: Period, now: number): number | null {
  if (period === 'all') return null;
  return addDays(startOfDay(now), -(PERIOD_DAYS[period] - 1));
}

export function filterByPeriod(sessions: SessionRecord[], period: Period, now: number) {
  const start = periodStart(period, now);
  return start === null ? sessions : sessions.filter((s) => s.startedAt >= start);
}

// ---------- Resumo ----------

export const sessionDurationSec = (s: SessionRecord) => s.workSec + s.restSec;
export const completionRate = (s: SessionRecord) =>
  s.phasesTotal ? s.phasesCompleted / s.phasesTotal : 0;

const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

export type StatsSummary = {
  sessions: number;
  completed: number;
  totalSec: number;
  totalWorkSec: number;
  avgCompletion: number | null;
  avgRating: number | null;
  avgRpe: number | null;
  lastSessionAt: number | null;
};

export function summarize(sessions: SessionRecord[]): StatsSummary {
  const done = sessions.filter((s) => s.status !== 'in_progress');
  return {
    sessions: done.length,
    completed: done.filter((s) => s.status === 'completed').length,
    totalSec: done.reduce((acc, s) => acc + sessionDurationSec(s), 0),
    totalWorkSec: done.reduce((acc, s) => acc + s.workSec, 0),
    avgCompletion: average(done.map(completionRate)),
    avgRating: average(done.map((s) => s.feedback?.rating).filter((v): v is number => v != null)),
    avgRpe: average(done.map((s) => s.feedback?.rpe).filter((v): v is number => v != null)),
    lastSessionAt: done.length ? Math.max(...done.map((s) => s.startedAt)) : null,
  };
}

// ---------- Dias, sequência e frequência ----------

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Dias (yyyy-mm-dd) em que houve treino. */
export function trainedDays(sessions: SessionRecord[]): Set<string> {
  return new Set(sessions.filter((s) => s.status !== 'in_progress').map((s) => dayKey(s.startedAt)));
}

/** Soma dias no calendário local (seguro com horário de verão). */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Segunda-feira 00:00 da semana de `ts`. */
export function weekStart(ts: number): number {
  const day = new Date(startOfDay(ts)).getDay();
  return addDays(startOfDay(ts), -((day + 6) % 7));
}

/**
 * Sequência de dias consecutivos com treino terminando hoje — ou ontem, para não
 * "zerar" a sequência antes de o usuário ter chance de treinar hoje.
 */
export function currentStreak(sessions: SessionRecord[], now: number): number {
  const days = trainedDays(sessions);
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Contagem de sessões por semana (segunda a domingo), da mais antiga à atual. */
export function weeklyCounts(
  sessions: SessionRecord[],
  now: number,
  weeks: number,
): { weekStart: number; count: number }[] {
  const current = weekStart(now);
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(current, -7 * (weeks - 1 - i)),
    count: 0,
  }));
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const s of sessions) {
    if (s.status === 'in_progress') continue;
    const i = index.get(weekStart(s.startedAt));
    if (i !== undefined) buckets[i].count++;
  }
  return buckets;
}

/** Exercícios mais pulados, a partir dos nomes registrados nas sessões. */
export function mostSkipped(skippedLabels: string[], limit = 5): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  skippedLabels.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Treinos mais realizados (ranking). */
export function topWorkouts(sessions: SessionRecord[], limit = 5) {
  const counts = new Map<string, { workoutId: string | null; name: string; count: number }>();
  for (const s of sessions) {
    if (s.status === 'in_progress') continue;
    const key = s.workoutId ?? `removido:${s.workoutName}`;
    const entry = counts.get(key) ?? { workoutId: s.workoutId, name: s.workoutName, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
