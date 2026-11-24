import { createStore } from 'zustand/vanilla';

import { createTabataWorkout, duplicateWorkout, type Workout } from '@/domain/workout';
import type {
  WorkoutRepository,
  WorkoutSummary,
} from '@/services/db/repositories/workoutRepository';

export type WorkoutsState = {
  summaries: WorkoutSummary[];
  loaded: boolean;
  load(): Promise<void>;
  save(workout: Workout): Promise<Workout>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<Workout | null>;
  toggleFavorite(id: string): Promise<void>;
  createTabata(): Promise<Workout>;
};

export function createWorkoutsStore(deps: {
  workouts: WorkoutRepository;
  getUserId: () => string | null;
  now?: () => number;
  /** Executado antes de listar (ex.: adicionar treinos embutidos na primeira vez). */
  beforeLoad?: () => Promise<void>;
}) {
  const { workouts, getUserId, now = Date.now, beforeLoad } = deps;

  return createStore<WorkoutsState>()((set, get) => ({
    summaries: [],
    loaded: false,

    async load() {
      await beforeLoad?.();
      const summaries = await workouts.listSummaries(getUserId());
      set({ summaries, loaded: true });
    },

    async save(workout) {
      const saved = await workouts.save(workout, getUserId());
      await get().load();
      return saved;
    },

    async remove(id) {
      await workouts.remove(id);
      await get().load();
    },

    async duplicate(id) {
      const source = await workouts.getById(id);
      if (!source) return null;
      const copy = await workouts.save(duplicateWorkout(source, now()), getUserId());
      await get().load();
      return copy;
    },

    async toggleFavorite(id) {
      const current = get().summaries.find((s) => s.id === id);
      if (!current) return;
      await workouts.setFavorite(id, !current.favorite);
      await get().load();
    },

    async createTabata() {
      return get().save(createTabataWorkout(now()));
    },
  }));
}

export type WorkoutsStore = ReturnType<typeof createWorkoutsStore>;
