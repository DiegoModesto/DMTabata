import { summarizeSession, type SessionLog, type SessionSummary } from '@/domain/sessionRecorder';
import {
  currentStreak,
  filterByPeriod,
  mostSkipped,
  periodStart,
  summarize,
  topWorkouts,
  trainedDays,
  validateFeedback,
  weeklyCounts,
  type Feedback,
  type Period,
} from '@/domain/stats';
import type { Timeline } from '@/domain/timeline';
import type { Workout } from '@/domain/workout';
import type { SessionRepository } from '@/services/db/repositories/sessionRepository';

export type FinishResult = { sessionId: string; summary: SessionSummary } | null;

/** Regras de negócio do registro de treinos e das estatísticas. */
export function createSessionService(deps: {
  sessions: SessionRepository;
  now?: () => number;
}) {
  const { sessions, now = Date.now } = deps;

  return {
    start: (workout: Workout, timeline: Timeline) =>
      sessions.start(workout, timeline.totalMs, now()),

    checkpoint: (sessionId: string, log: SessionLog) =>
      sessions.checkpoint(sessionId, summarizeSession(log)),

    /**
     * Encerra a sessão. Sessões sem nenhum tempo de trabalho (ex.: parou durante o
     * preparo) são descartadas para não poluir as estatísticas.
     */
    async finish(
      sessionId: string,
      log: SessionLog,
      stoppedEarly: boolean,
      extras: { roundsDone?: number | null } = {},
    ): Promise<FinishResult> {
      const summary = summarizeSession(log);
      if (summary.workMs < 1000) {
        await sessions.remove(sessionId);
        return null;
      }
      await sessions.finish(sessionId, {
        status: stoppedEarly ? 'abandoned' : 'completed',
        endedAt: now(),
        log,
        summary,
        roundsDone: extras.roundsDone ?? null,
      });
      return { sessionId, summary };
    },

    abandonStale: () => sessions.abandonStale(now()),

    getSession: (id: string) => sessions.getById(id),
    sessionPhases: (id: string) => sessions.phases(id),

    /** Valida e grava o feedback; devolve a lista de erros (vazia = salvo). */
    async saveFeedback(sessionId: string, feedback: Feedback): Promise<string[]> {
      const errors = validateFeedback(feedback);
      if (errors.length === 0) await sessions.saveFeedback(sessionId, feedback);
      return errors;
    },

    async workoutStats(workoutId: string, period: Period) {
      const all = await sessions.list({ workoutId });
      const list = filterByPeriod(all, period, now());
      const skipped = await sessions.skippedExerciseLabels(list.map((s) => s.id));
      return {
        summary: summarize(list),
        sessions: list,
        mostSkipped: mostSkipped(skipped),
        weekly: weeklyCounts(all, now(), 8),
      };
    },

    async overview(userId: string | null) {
      const current = now();
      const all = await sessions.list({ userId });
      const week = all.filter((s) => s.startedAt >= (periodStart('7d', current) ?? 0));
      const month = all.filter((s) => s.startedAt >= (periodStart('30d', current) ?? 0));
      return {
        week: summarize(week),
        month: summarize(month),
        streak: currentStreak(all, current),
        weekly: weeklyCounts(all, current, 8),
        trainedDays: trainedDays(all),
        topWorkouts: topWorkouts(month),
        recent: all.slice(0, 10),
      };
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
