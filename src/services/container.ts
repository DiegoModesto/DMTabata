import { createAuthStore } from '@/stores/authStore';
import { createWorkoutsStore } from '@/stores/workoutsStore';

import { createSilentAlertPlayer, type AlertPlayer } from './audio/alertPlayer';
import type { SoundImporter } from './audio/soundImporter';
import type { BackupIO } from './backup/backupIO';
import { createBackupService } from './backup/backupService';
import { BUNDLED_WORKOUTS, type BundledWorkout } from './library/bundledWorkouts';
import { createWorkoutLibrary } from './library/workoutLibrary';
import { createMockAuthService } from './auth/mockAuthService';
import type { SqlDatabase } from './db/database';
import { createSessionRepository } from './db/repositories/sessionRepository';
import { createSettingsRepository } from './db/repositories/settingsRepository';
import { createSoundConfigRepository } from './db/repositories/soundConfigRepository';
import { createSoundRepository } from './db/repositories/soundRepository';
import { createUserRepository } from './db/repositories/userRepository';
import { createWorkoutRepository } from './db/repositories/workoutRepository';
import { createNoopPhaseNotifier, type PhaseNotifier } from './notifications/phaseNotifier';
import { createSessionService } from './sessions/sessionService';
import { createSoundService } from './sounds/soundService';

export type ServiceOverrides = {
  alertPlayer?: AlertPlayer;
  soundImporter?: SoundImporter;
  phaseNotifier?: PhaseNotifier;
  backupIO?: BackupIO;
  /** Relógio monotônico em ms (para o temporizador). */
  clock?: () => number;
  /** Data/hora atual (epoch ms) para registros e estatísticas. */
  now?: () => number;
  /** Treinos embutidos (testes podem trocar por uma lista própria). */
  bundledWorkouts?: BundledWorkout[];
};

const unavailableImporter: SoundImporter = {
  pick: async () => null,
  persist: async () => {
    throw new Error('Importação de sons indisponível.');
  },
  persistFile: async () => {
    throw new Error('Gravação de sons indisponível.');
  },
  remove: async () => {},
  resolve: (uri) => uri,
};

const unavailableBackupIO: BackupIO = {
  share: async () => {
    throw new Error('Exportação indisponível.');
  },
  pickText: async () => null,
  readUri: async () => {
    throw new Error('Leitura de arquivos indisponível.');
  },
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
  const getUserId = () => authStore.getState().user?.id ?? null;
  const backupIO = overrides.backupIO ?? unavailableBackupIO;
  const library = createWorkoutLibrary({
    workouts,
    configs: soundConfigs,
    sounds,
    settings,
    io: backupIO,
    bundled: overrides.bundledWorkouts ?? BUNDLED_WORKOUTS,
    getUserId,
    now: overrides.now,
  });
  const workoutsStore = createWorkoutsStore({
    workouts,
    getUserId,
    beforeLoad: () => library.ensureBundledWorkouts(),
  });

  const backupService = createBackupService({
    workouts,
    sounds,
    io: backupIO,
    getUserId: () => authStore.getState().user?.id ?? null,
    now: overrides.now,
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
    backupService,
    library,
    phaseNotifier: overrides.phaseNotifier ?? createNoopPhaseNotifier(),
    soundService,
    alertPlayer,
    clock: overrides.clock ?? defaultClock,
  };
}

export type Services = ReturnType<typeof createServices>;
