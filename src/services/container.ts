import { createAuthStore } from '@/stores/authStore';
import { createWorkoutsStore } from '@/stores/workoutsStore';

import { createSilentAlertPlayer, type AlertPlayer } from './audio/alertPlayer';
import { createMockAuthService } from './auth/mockAuthService';
import type { SqlDatabase } from './db/database';
import { createSettingsRepository } from './db/repositories/settingsRepository';
import { createUserRepository } from './db/repositories/userRepository';
import { createWorkoutRepository } from './db/repositories/workoutRepository';

export type ServiceOverrides = {
  alertPlayer?: AlertPlayer;
  /** Relógio monotônico em ms (para o temporizador). */
  clock?: () => number;
};

const defaultClock = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/**
 * Composição das dependências do app (injeção manual).
 * Telas e stores recebem tudo por aqui — nos testes, basta montar com um banco de teste.
 */
export function createServices(db: SqlDatabase, overrides: ServiceOverrides = {}) {
  const settings = createSettingsRepository(db);
  const users = createUserRepository(db);
  const workouts = createWorkoutRepository(db);
  const auth = createMockAuthService({ users, settings });
  const authStore = createAuthStore(auth);
  const workoutsStore = createWorkoutsStore({
    workouts,
    getUserId: () => authStore.getState().user?.id ?? null,
  });

  return {
    db,
    settings,
    users,
    workouts,
    auth,
    authStore,
    workoutsStore,
    alertPlayer: overrides.alertPlayer ?? createSilentAlertPlayer(),
    clock: overrides.clock ?? defaultClock,
  };
}

export type Services = ReturnType<typeof createServices>;
