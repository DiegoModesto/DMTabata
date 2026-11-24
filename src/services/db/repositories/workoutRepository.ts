import { workoutTotals, type Cycle, type Workout, type WorkoutType } from '@/domain/workout';

import type { SqlDatabase } from '../database';

type WorkoutRow = {
  id: string;
  user_id: string | null;
  name: string;
  type: WorkoutType;
  prepare_sec: number;
  cooldown_sec: number;
  rest_between_cycles_sec: number;
  sound_config_id: string | null;
  color: string | null;
  favorite: number;
  created_at: number;
  updated_at: number;
};

type CycleRow = {
  id: string;
  workout_id: string;
  position: number;
  name: string;
  repeat_count: number;
  default_work_sec: number;
  default_rest_sec: number;
  skip_last_rest: number;
};

type ItemRow = {
  id: string;
  cycle_id: string;
  position: number;
  label: string | null;
  work_sec: number | null;
  rest_sec: number | null;
  work_sound_id: string | null;
  rest_sound_id: string | null;
};

export type WorkoutSummary = {
  id: string;
  name: string;
  type: WorkoutType;
  favorite: boolean;
  cycleCount: number;
  exerciseCount: number;
  totalSec: number;
  updatedAt: number;
};

function assemble(row: WorkoutRow, cycleRows: CycleRow[], itemRows: ItemRow[]): Workout {
  const cycles: Cycle[] = cycleRows
    .filter((c) => c.workout_id === row.id)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      repeatCount: c.repeat_count,
      defaultWorkSec: c.default_work_sec,
      defaultRestSec: c.default_rest_sec,
      skipLastRest: c.skip_last_rest === 1,
      items: itemRows
        .filter((i) => i.cycle_id === c.id)
        .sort((a, b) => a.position - b.position)
        .map((i) => ({
          id: i.id,
          label: i.label ?? '',
          workSec: i.work_sec,
          restSec: i.rest_sec,
          workSoundId: i.work_sound_id,
          restSoundId: i.rest_sound_id,
        })),
    }));

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    prepareSec: row.prepare_sec,
    cooldownSec: row.cooldown_sec,
    restBetweenCyclesSec: row.rest_between_cycles_sec,
    soundConfigId: row.sound_config_id,
    color: row.color,
    favorite: row.favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cycles,
  };
}

export function toSummary(workout: Workout): WorkoutSummary {
  const totals = workoutTotals(workout);
  return {
    id: workout.id,
    name: workout.name,
    type: workout.type,
    favorite: workout.favorite,
    cycleCount: workout.cycles.length,
    exerciseCount: totals.exerciseCount,
    totalSec: totals.totalSec,
    updatedAt: workout.updatedAt,
  };
}

export function createWorkoutRepository(db: SqlDatabase, now: () => number = Date.now) {
  async function loadMany(where: string, params: (string | number)[]): Promise<Workout[]> {
    const rows = await db.getAllAsync<WorkoutRow>(`SELECT * FROM workouts ${where}`, params);
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const marks = ids.map(() => '?').join(',');
    const cycles = await db.getAllAsync<CycleRow>(
      `SELECT * FROM cycles WHERE workout_id IN (${marks})`,
      ids,
    );
    const cycleIds = cycles.map((c) => c.id);
    const items = cycleIds.length
      ? await db.getAllAsync<ItemRow>(
          `SELECT * FROM cycle_items WHERE cycle_id IN (${cycleIds.map(() => '?').join(',')})`,
          cycleIds,
        )
      : [];
    return rows.map((r) => assemble(r, cycles, items));
  }

  return {
    async getById(id: string): Promise<Workout | null> {
      const [workout] = await loadMany('WHERE id = ?', [id]);
      return workout ?? null;
    },

    /** Lista do usuário: favoritos primeiro, depois os mais recentes. */
    async listSummaries(userId: string | null): Promise<WorkoutSummary[]> {
      const workouts = userId
        ? await loadMany('WHERE user_id = ? ORDER BY favorite DESC, updated_at DESC', [userId])
        : await loadMany('ORDER BY favorite DESC, updated_at DESC', []);
      return workouts.map(toSummary);
    },

    /** Cria ou substitui o treino (e todos os ciclos/itens) de forma atômica. */
    async save(workout: Workout, userId: string | null): Promise<Workout> {
      const saved: Workout = { ...workout, updatedAt: now() };
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO workouts (id, user_id, name, type, prepare_sec, cooldown_sec,
             rest_between_cycles_sec, sound_config_id, color, favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, type = excluded.type, prepare_sec = excluded.prepare_sec,
             cooldown_sec = excluded.cooldown_sec,
             rest_between_cycles_sec = excluded.rest_between_cycles_sec,
             sound_config_id = excluded.sound_config_id, color = excluded.color,
             favorite = excluded.favorite, updated_at = excluded.updated_at`,
          [
            saved.id,
            userId,
            saved.name.trim(),
            saved.type,
            saved.prepareSec,
            saved.cooldownSec,
            saved.restBetweenCyclesSec,
            saved.soundConfigId,
            saved.color,
            saved.favorite ? 1 : 0,
            saved.createdAt,
            saved.updatedAt,
          ],
        );
        await db.runAsync('DELETE FROM cycles WHERE workout_id = ?', [saved.id]);
        for (const [position, cycle] of saved.cycles.entries()) {
          await db.runAsync(
            `INSERT INTO cycles (id, workout_id, position, name, repeat_count, default_work_sec,
               default_rest_sec, skip_last_rest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cycle.id,
              saved.id,
              position,
              cycle.name.trim(),
              cycle.repeatCount,
              cycle.defaultWorkSec,
              cycle.defaultRestSec,
              cycle.skipLastRest ? 1 : 0,
            ],
          );
          for (const [itemPosition, item] of cycle.items.entries()) {
            await db.runAsync(
              `INSERT INTO cycle_items (id, cycle_id, position, label, work_sec, rest_sec,
                 work_sound_id, rest_sound_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                item.id,
                cycle.id,
                itemPosition,
                item.label.trim(),
                item.workSec,
                item.restSec,
                item.workSoundId,
                item.restSoundId,
              ],
            );
          }
        }
      });
      return saved;
    },

    /** Remove o treino (ciclos/itens em cascata) e sua configuração de sons própria. */
    async remove(id: string): Promise<void> {
      await db.withTransactionAsync(async () => {
        const row = await db.getFirstAsync<{ sound_config_id: string | null }>(
          'SELECT sound_config_id FROM workouts WHERE id = ?',
          [id],
        );
        await db.runAsync('DELETE FROM workouts WHERE id = ?', [id]);
        if (row?.sound_config_id && row.sound_config_id !== 'global') {
          await db.runAsync('DELETE FROM sound_configs WHERE id = ?', [row.sound_config_id]);
        }
      });
    },

    async setSoundConfig(id: string, soundConfigId: string | null): Promise<void> {
      await db.runAsync('UPDATE workouts SET sound_config_id = ? WHERE id = ?', [soundConfigId, id]);
    },

    async setFavorite(id: string, favorite: boolean): Promise<void> {
      await db.runAsync('UPDATE workouts SET favorite = ? WHERE id = ?', [favorite ? 1 : 0, id]);
    },
  };
}

export type WorkoutRepository = ReturnType<typeof createWorkoutRepository>;
