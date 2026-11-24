import { createId } from '@/domain/id';
import { isBuiltinSoundId } from '@/domain/sounds';
import {
  buildWorkoutFile,
  parseWorkoutFile,
  serializeWorkoutFile,
  WORKOUT_FILE_EXTENSION,
  workoutFileName,
  type ParsedWorkoutFile,
} from '@/domain/workoutFile';
import { workoutTotals, type Workout } from '@/domain/workout';
import type { BackupIO } from '@/services/backup/backupIO';
import type { SettingsRepository } from '@/services/db/repositories/settingsRepository';
import type { SoundConfigRepository } from '@/services/db/repositories/soundConfigRepository';
import type { SoundRepository } from '@/services/db/repositories/soundRepository';
import type { WorkoutRepository } from '@/services/db/repositories/workoutRepository';

import type { BundledWorkout } from './bundledWorkouts';

export const USER_TEMPLATES_KEY = 'library.userTemplates';
export const SEEDED_BUNDLED_KEY = 'library.seededBundled';
export const WORKOUT_MIME = 'application/x-dmtabata';
export const WORKOUT_UTI = 'com.dmtabata.workout';

type StoredTemplate = { id: string; file: unknown };

export type LibraryTemplate = {
  id: string;
  source: 'bundled' | 'user';
  name: string;
  totalSec: number;
  cycleCount: number;
  exerciseCount: number;
};

export type ImportWorkoutOutcome =
  | { status: 'imported'; workout: Workout; missingSounds: number }
  | { status: 'error'; reason: string }
  | { status: 'canceled' };

/**
 * Biblioteca de treinos: compartilhar como arquivo, importar, salvar como modelo
 * e treinos embutidos no app.
 */
export function createWorkoutLibrary(deps: {
  workouts: WorkoutRepository;
  configs: SoundConfigRepository;
  sounds: SoundRepository;
  settings: SettingsRepository;
  io: BackupIO;
  bundled: BundledWorkout[];
  getUserId: () => string | null;
  now?: () => number;
}) {
  const { workouts, configs, sounds, settings, io, bundled, getUserId, now = Date.now } = deps;

  const knownSoundIds = async () => new Set((await sounds.list()).map((s) => s.id));

  async function parse(input: unknown): Promise<ParsedWorkoutFile> {
    return parseWorkoutFile(input, { knownSoundIds: await knownSoundIds(), now: now() });
  }

  /** Salva o treino lido (com ids novos) e, se houver, a configuração de sons dele. */
  async function saveParsed(parsed: Extract<ParsedWorkoutFile, { ok: true }>): Promise<Workout> {
    const saved = await workouts.save(parsed.workout, getUserId());
    if (!parsed.sounds) return saved;
    const configId = createId();
    await configs.save({ id: configId, ...parsed.sounds });
    await workouts.setSoundConfig(saved.id, configId);
    return { ...saved, soundConfigId: configId };
  }

  async function fileFor(workoutId: string) {
    const workout = await workouts.getById(workoutId);
    if (!workout) throw new Error('Treino não encontrado.');
    const config = workout.soundConfigId ? await configs.getById(workout.soundConfigId) : null;
    return { workout, ...buildWorkoutFile(workout, config, isBuiltinSoundId, now()) };
  }

  async function userTemplates(): Promise<StoredTemplate[]> {
    return (await settings.get<StoredTemplate[]>(USER_TEMPLATES_KEY)) ?? [];
  }

  async function describe(t: StoredTemplate, source: LibraryTemplate['source']) {
    const parsed = await parse(t.file);
    if (!parsed.ok) return null;
    const { workout } = parsed;
    return {
      id: t.id,
      source,
      name: workout.name,
      totalSec: workoutTotals(workout).totalSec,
      cycleCount: workout.cycles.length,
      exerciseCount: workout.cycles.reduce((n, c) => n + c.items.length, 0),
    } satisfies LibraryTemplate;
  }

  let seeding: Promise<void> | null = null;

  async function seedBundled() {
    if (!getUserId() || bundled.length === 0) return;
    const seeded = (await settings.get<string[]>(SEEDED_BUNDLED_KEY)) ?? [];
    const pending = bundled.filter((b) => !seeded.includes(b.id));
    if (pending.length === 0) return;
    for (const b of pending) {
      const parsed = await parse(b.file);
      if (parsed.ok) await saveParsed(parsed);
      seeded.push(b.id);
    }
    await settings.set(SEEDED_BUNDLED_KEY, seeded);
  }

  return {
    /** Compartilha o treino como arquivo `.dmtabata`. Devolve quantos sons ficaram de fora. */
    async shareWorkout(workoutId: string): Promise<{ droppedSounds: number }> {
      const { workout, file, droppedSounds } = await fileFor(workoutId);
      await io.share(workoutFileName(workout.name), serializeWorkoutFile(file), {
        mimeType: WORKOUT_MIME,
        uti: WORKOUT_UTI,
        title: `Compartilhar "${workout.name}"`,
      });
      return { droppedSounds };
    },

    /** Lê um arquivo de treino sem salvar (para mostrar antes de importar). */
    preview: (text: string) => parse(text),

    async importText(text: string): Promise<ImportWorkoutOutcome> {
      const parsed = await parse(text);
      if (!parsed.ok) return { status: 'error', reason: parsed.reason };
      return {
        status: 'imported',
        workout: await saveParsed(parsed),
        missingSounds: parsed.missingSounds,
      };
    },

    /** Lê um arquivo recebido de outro app (ex.: tocado no WhatsApp). */
    readUri: (uri: string) => io.readUri(uri),

    /** Escolhe um arquivo `.dmtabata` e importa o treino. */
    async importFromPicker(): Promise<ImportWorkoutOutcome> {
      const text = await io.pickText();
      if (text === null) return { status: 'canceled' };
      return this.importText(text);
    },

    /** Guarda uma cópia do treino em "Meus modelos". */
    async saveAsTemplate(workoutId: string): Promise<LibraryTemplate> {
      const { file } = await fileFor(workoutId);
      const stored: StoredTemplate = { id: createId(), file };
      await settings.set(USER_TEMPLATES_KEY, [...(await userTemplates()), stored]);
      const described = await describe(stored, 'user');
      if (!described) throw new Error('Não foi possível salvar o modelo.');
      return described;
    },

    async removeTemplate(id: string): Promise<void> {
      await settings.set(
        USER_TEMPLATES_KEY,
        (await userTemplates()).filter((t) => t.id !== id),
      );
    },

    /** Modelos do DMTabata (embutidos) e meus modelos. */
    async templates(): Promise<LibraryTemplate[]> {
      const all = [
        ...(await Promise.all(bundled.map((b) => describe(b, 'bundled')))),
        ...(await Promise.all((await userTemplates()).map((t) => describe(t, 'user')))),
      ];
      return all.filter((t): t is LibraryTemplate => t !== null);
    },

    /** Cria um treino novo (cópia) a partir de um modelo. */
    async createFromTemplate(id: string): Promise<Workout> {
      const source =
        bundled.find((b) => b.id === id) ?? (await userTemplates()).find((t) => t.id === id);
      if (!source) throw new Error('Modelo não encontrado.');
      const parsed = await parse(source.file);
      if (!parsed.ok) throw new Error(parsed.reason);
      return saveParsed(parsed);
    },

    /**
     * Adiciona à lista, uma única vez, os treinos embutidos ainda não adicionados.
     * Se o usuário apagar um deles, ele não volta.
     */
    ensureBundledWorkouts(): Promise<void> {
      seeding ??= seedBundled().finally(() => {
        seeding = null;
      });
      return seeding;
    },

    fileExtension: WORKOUT_FILE_EXTENSION,
  };
}

export type WorkoutLibrary = ReturnType<typeof createWorkoutLibrary>;
