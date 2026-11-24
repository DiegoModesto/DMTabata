import { createId } from '@/domain/id';
import { emptySoundConfig, resolveAlertSettings, type SoundConfig } from '@/domain/soundConfig';
import {
  checkImport,
  checkRecording,
  recordingExtension,
  recordingName,
  type SoundEntry,
} from '@/domain/sounds';
import type { AlertSettings } from '@/domain/alerts';
import type { Workout } from '@/domain/workout';
import type { AlertPlayer } from '@/services/audio/alertPlayer';
import type { SoundImporter } from '@/services/audio/soundImporter';
import type { SoundConfigRepository } from '@/services/db/repositories/soundConfigRepository';
import type { SoundRepository } from '@/services/db/repositories/soundRepository';
import type { WorkoutRepository } from '@/services/db/repositories/workoutRepository';
import { GLOBAL_SOUND_CONFIG_ID } from '@/services/db/seed';

export type ImportResult =
  | { status: 'imported'; sound: SoundEntry }
  | { status: 'rejected'; reason: string }
  | { status: 'canceled' };

export type SaveRecordingResult =
  { status: 'saved'; sound: SoundEntry } | { status: 'rejected'; reason: string };

/** Regras de negócio de sons: biblioteca, importação e configurações em camadas. */
export function createSoundService(deps: {
  sounds: SoundRepository;
  configs: SoundConfigRepository;
  workouts: WorkoutRepository;
  importer: SoundImporter;
  alertPlayer: AlertPlayer;
}) {
  const { sounds, configs, workouts, importer, alertPlayer } = deps;

  async function globalConfig(): Promise<SoundConfig> {
    return (
      (await configs.getById(GLOBAL_SOUND_CONFIG_ID)) ??
      emptySoundConfig(GLOBAL_SOUND_CONFIG_ID, 'Sons globais')
    );
  }

  return {
    library: () => sounds.list(),

    /** Disponibiliza os arquivos importados para o player de áudio. */
    async registerUserSources(): Promise<void> {
      const list = await sounds.list();
      alertPlayer.registerSources(
        Object.fromEntries(list.filter((s) => s.source === 'user').map((s) => [s.id, s.uri])),
      );
    },

    async importSound(): Promise<ImportResult> {
      const picked = await importer.pick();
      if (!picked) return { status: 'canceled' };
      const check = checkImport({ fileName: picked.fileName, sizeBytes: picked.sizeBytes });
      if (!check.ok) return { status: 'rejected', reason: check.reason };
      const id = createId();
      const uri = await importer.persist(picked, id, check.extension);
      try {
        const sound = await sounds.addUserSound({ id, name: check.name, uri });
        alertPlayer.registerSources({ [id]: uri });
        return { status: 'imported', sound };
      } catch (error) {
        await importer.remove(uri);
        throw error;
      }
    },

    /**
     * Salva uma gravação do microfone (até 3 s) como som do usuário.
     * O arquivo temporário do gravador é sempre descartado.
     */
    async saveRecording(input: {
      uri: string;
      durationMs: number;
      sizeBytes: number | null;
      name: string;
      suggestedName: string;
    }): Promise<SaveRecordingResult> {
      const check = checkRecording(input);
      if (!check.ok) {
        await importer.remove(input.uri);
        return { status: 'rejected', reason: check.reason };
      }
      const id = createId();
      let uri: string | null = null;
      try {
        uri = await importer.persistFile(input.uri, id, recordingExtension(input.uri));
        const sound = await sounds.addUserSound({
          id,
          name: recordingName(input.name, input.suggestedName),
          uri,
        });
        alertPlayer.registerSources({ [id]: uri });
        return { status: 'saved', sound };
      } catch (error) {
        if (uri) await importer.remove(uri);
        throw error;
      } finally {
        await importer.remove(input.uri);
      }
    },

    /** Descarta uma gravação que o usuário não quis salvar. */
    discardRecording: (uri: string) => importer.remove(uri),

    async renameSound(id: string, name: string): Promise<void> {
      const trimmed = name.trim();
      if (trimmed) await sounds.rename(id, trimmed.slice(0, 40));
    },

    /** Remove um som importado; quem o usava volta ao som herdado. */
    async removeSound(id: string): Promise<boolean> {
      const removed = await sounds.removeUserSound(id);
      if (!removed) return false;
      await importer.remove(removed.uri);
      return true;
    },

    globalConfig,
    saveConfig: (config: SoundConfig) => configs.save(config),

    /** Configuração própria do treino, ou null se ele usa os sons globais. */
    async workoutConfig(workoutId: string): Promise<SoundConfig | null> {
      const workout = await workouts.getById(workoutId);
      if (!workout?.soundConfigId) return null;
      return configs.getById(workout.soundConfigId);
    },

    /** Passa o treino a ter sons próprios (começando herdando tudo do global). */
    async personalizeWorkout(workoutId: string): Promise<SoundConfig> {
      const existing = await this.workoutConfig(workoutId);
      if (existing) return existing;
      const config = emptySoundConfig(createId(), 'Sons do treino');
      await configs.save(config);
      await workouts.setSoundConfig(workoutId, config.id);
      return config;
    },

    /** Volta a usar os sons globais, descartando a configuração do treino. */
    async useGlobalForWorkout(workoutId: string): Promise<void> {
      const workout = await workouts.getById(workoutId);
      if (!workout?.soundConfigId) return;
      await workouts.setSoundConfig(workoutId, null);
      await configs.remove(workout.soundConfigId);
    },

    /** Configuração efetiva para tocar o treino: padrão → global → treino. */
    async settingsForWorkout(workout: Workout): Promise<AlertSettings> {
      const global = await globalConfig();
      const own = workout.soundConfigId ? await configs.getById(workout.soundConfigId) : null;
      const settings = resolveAlertSettings(global, own);
      // Sons removidos da biblioteca saem do sorteio.
      const available = new Set((await sounds.list()).map((s) => s.id));
      return {
        ...settings,
        surpriseSounds: settings.surpriseSounds.filter((id) => available.has(id)),
      };
    },
  };
}

export type SoundService = ReturnType<typeof createSoundService>;
