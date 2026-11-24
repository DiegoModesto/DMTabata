import { createAuthStore } from '@/stores/authStore';
import { createWorkoutsStore } from '@/stores/workoutsStore';

import { createSilentAlertPlayer, type AlertPlayer } from './audio/alertPlayer';
import type { SoundImporter } from './audio/soundImporter';
import { createMockAuthService } from './auth/mockAuthService';
import type { SqlDatabase } from './db/database';
import { createSessionRepository } from './db/repositories/sessionRepository';
import { createSettingsRepository } from './db/repositories/settingsRepository';
import { createSoundConfigRepository } from './db/repositories/soundConfigRepository';
import { createSoundRepository } from './db/repositories/soundRepository';
import { createUserRepository } from './db/repositories/userRepository';
import { createWorkoutRepository } from './db/repositories/workoutRepository';
import { createSessionService } from './sessions/sessionService';
import { createSoundService } from './sounds/soundService';

export type ServiceOverrides = {
  alertPlayer?: AlertPlayer;
  soundImporter?: SoundImporter;
  /** Relógio monotônico em ms (para o temporizador). */
  clock?: () => number;
  /** Data/hora atual (epoch ms) para registros e estatísticas. */
  now?: () => number;
};

const unavailableImporter: SoundImporter = {
  pick: async () => null,
  persist: async () => {
    throw new Error('Importação de sons indisponível.');
  },
  remove: async () => {},
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
  const alertPlayer = overrides.alertPlayer ?? createSilentAlertPlayer();
  const sounds = createSoundRepository(db);
  const soundConfigs = createSoundConfigRepository(db);
  const soundService = createSoundService({
    sounds,
    configs: soundConfigs,
    workouts,
    importer: overrides.soundImporter ?? unavailableImporter,
    alertPlayer,
  });
  const sessions = createSessionRepository(db);
  const sessionService = createSessionService({ sessions, now: overrides.now });
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
    sounds,
    soundConfigs,
    sessions,
    sessionService,
    soundService,
    alertPlayer,
    clock: overrides.clock ?? defaultClock,
  };
}

export type Services = ReturnType<typeof createServices>;
