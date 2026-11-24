import { createId } from '@/domain/id';
import type { SessionLog, SessionSummary } from '@/domain/sessionRecorder';
import type { Feedback, SessionRecord, SessionStatus } from '@/domain/stats';
import type { Workout } from '@/domain/workout';

import type { SqlDatabase } from '../database';

type SessionRow = {
  id: string;
  workout_id: string | null;
  workout_snapshot: string;
  started_at: number;
  ended_at: number | null;
  status: SessionStatus;
  planned_total_sec: number;
  actual_work_sec: number;
  actual_rest_sec: number;
  paused_sec: number;
  phases_completed: number;
  phases_skipped: number;
  phases_total: number;
  rounds_done: number | null;
  rating: number | null;
  rpe: number | null;
  mood: Feedback['mood'];
  difficulty: Feedback['difficulty'];
  notes: string | null;
  has_feedback: number | null;
};

export type SessionPhaseRecord = {
  phaseIndex: number;
  kind: string;
  cyclePosition: number | null;
  itemPosition: number | null;
  exerciseLabel: string | null;
  plannedMs: number;
  actualMs: number;
  skipped: boolean;
};

const SELECT = `
  SELECT s.*, f.rating, f.rpe, f.mood, f.difficulty, f.notes,
         CASE WHEN f.session_id IS NULL THEN 0 ELSE 1 END AS has_feedback
  FROM sessions s LEFT JOIN session_feedback f ON f.session_id = s.id`;

function toRecord(row: SessionRow): SessionRecord {
  let workoutName = 'Treino';
  try {
    workoutName = (JSON.parse(row.workout_snapshot) as Workout).name || workoutName;
  } catch {}
  return {
    id: row.id,
    workoutId: row.workout_id,
    workoutName,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
    plannedSec: row.planned_total_sec,
    workSec: row.actual_work_sec,
    restSec: row.actual_rest_sec,
    pausedSec: row.paused_sec,
    phasesCompleted: row.phases_completed,
    phasesSkipped: row.phases_skipped,
    phasesTotal: row.phases_total,
    roundsDone: row.rounds_done,
    feedback: row.has_feedback
      ? {
          rating: row.rating,
          rpe: row.rpe,
          mood: row.mood,
          difficulty: row.difficulty,
          notes: row.notes,
        }
      : null,
  };
}

const toSec = (ms: number) => Math.round(ms / 1000);

export function createSessionRepository(db: SqlDatabase) {
  async function writeTotals(id: string, summary: SessionSummary) {
    await db.runAsync(
      `UPDATE sessions SET actual_work_sec = ?, actual_rest_sec = ?, paused_sec = ?,
         phases_completed = ?, phases_skipped = ?, phases_total = ? WHERE id = ?`,
      [
        toSec(summary.workMs),
        toSec(summary.restMs),
        toSec(summary.pausedMs),
        summary.phasesCompleted,
        summary.phasesSkipped,
        summary.phasesTotal,
        id,
      ],
    );
  }

  return {
    /** Abre uma sessão "em andamento" com uma cópia do treino como estava ao começar. */
    async start(workout: Workout, plannedMs: number, startedAt: number): Promise<string> {
      const id = createId();
      await db.runAsync(
        `INSERT INTO sessions (id, workout_id, workout_snapshot, started_at, status,
           planned_total_sec, phases_total)
         VALUES (?, ?, ?, ?, 'in_progress', ?, 0)`,
        [id, workout.id, JSON.stringify(workout), startedAt, toSec(plannedMs)],
      );
      return id;
    },

    /** Salva os totais parciais (se o app fechar, a sessão não se perde). */
    checkpoint: writeTotals,

    /** Fecha a sessão gravando totais e o log de cada fase, de forma atômica. */
    async finish(
      id: string,
      input: {
        status: Exclude<SessionStatus, 'in_progress'>;
        endedAt: number;
        log: SessionLog;
        summary: SessionSummary;
        roundsDone?: number | null;
      },
    ): Promise<void> {
      await db.withTransactionAsync(async () => {
        await writeTotals(id, input.summary);
        await db.runAsync(
          'UPDATE sessions SET status = ?, ended_at = ?, rounds_done = ? WHERE id = ?',
          [input.status, input.endedAt, input.roundsDone ?? null, id],
        );
        await db.runAsync('DELETE FROM session_phases WHERE session_id = ?', [id]);
        for (const phase of input.log.phases) {
          await db.runAsync(
            `INSERT INTO session_phases (id, session_id, phase_index, kind, cycle_position,
               item_position, exercise_label, planned_ms, actual_ms, skipped)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              createId(),
              id,
              phase.index,
              phase.kind,
              phase.cycleIndex,
              phase.itemIndex,
              phase.kind === 'work' ? phase.label : null,
              phase.plannedMs,
              Math.round(phase.actualMs),
              phase.skipped ? 1 : 0,
            ],
          );
        }
      });
    },

    async remove(id: string): Promise<void> {
      await db.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
    },

    /** Sessões que ficaram "em andamento" (app fechado no meio) viram interrompidas. */
    async abandonStale(endedAt: number): Promise<number> {
      const result = await db.runAsync(
        "UPDATE sessions SET status = 'abandoned', ended_at = ? WHERE status = 'in_progress'",
        [endedAt],
      );
      return result.changes;
    },

    async getById(id: string): Promise<SessionRecord | null> {
      const row = await db.getFirstAsync<SessionRow>(`${SELECT} WHERE s.id = ?`, [id]);
      return row ? toRecord(row) : null;
    },

    async list(filter: { workoutId?: string; userId?: string | null; since?: number | null } = {}) {
      const where: string[] = ["s.status <> 'in_progress'"];
      const params: (string | number)[] = [];
      if (filter.workoutId) {
        where.push('s.workout_id = ?');
        params.push(filter.workoutId);
      }
      if (filter.userId) {
        // Sessões de treinos do usuário (ou de treinos já excluídos).
        where.push(
          '(s.workout_id IS NULL OR s.workout_id IN (SELECT id FROM workouts WHERE user_id = ?))',
        );
        params.push(filter.userId);
      }
      if (filter.since != null) {
        where.push('s.started_at >= ?');
        params.push(filter.since);
      }
      const rows = await db.getAllAsync<SessionRow>(
        `${SELECT} WHERE ${where.join(' AND ')} ORDER BY s.started_at DESC`,
        params,
      );
      return rows.map(toRecord);
    },

    async phases(sessionId: string): Promise<SessionPhaseRecord[]> {
      const rows = await db.getAllAsync<{
        phase_index: number;
        kind: string;
        cycle_position: number | null;
        item_position: number | null;
        exercise_label: string | null;
        planned_ms: number;
        actual_ms: number;
        skipped: number;
      }>('SELECT * FROM session_phases WHERE session_id = ? ORDER BY phase_index', [sessionId]);
      return rows.map((r) => ({
        phaseIndex: r.phase_index,
        kind: r.kind,
        cyclePosition: r.cycle_position,
        itemPosition: r.item_position,
        exerciseLabel: r.exercise_label,
        plannedMs: r.planned_ms,
        actualMs: r.actual_ms,
        skipped: r.skipped === 1,
      }));
    },

    /** Nomes dos exercícios pulados (não concluídos) nas sessões informadas. */
    async skippedExerciseLabels(sessionIds: string[]): Promise<string[]> {
      if (sessionIds.length === 0) return [];
      const marks = sessionIds.map(() => '?').join(',');
      const rows = await db.getAllAsync<{ exercise_label: string }>(
        `SELECT exercise_label FROM session_phases
         WHERE session_id IN (${marks}) AND kind = 'work' AND skipped = 1
           AND actual_ms < planned_ms - 250 AND exercise_label IS NOT NULL`,
        sessionIds,
      );
      return rows.map((r) => r.exercise_label);
    },

    async saveFeedback(sessionId: string, feedback: Feedback): Promise<void> {
      await db.runAsync(
        `INSERT INTO session_feedback (session_id, rating, rpe, mood, difficulty, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET rating = excluded.rating, rpe = excluded.rpe,
           mood = excluded.mood, difficulty = excluded.difficulty, notes = excluded.notes`,
        [
          sessionId,
          feedback.rating,
          feedback.rpe,
          feedback.mood,
          feedback.difficulty,
          feedback.notes?.trim() || null,
        ],
      );
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
