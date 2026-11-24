import { ALERT_SLOTS, SILENT_SOUND_ID, type AlertSlot, type SoundId } from './alerts';
import { normalizeWorkout } from './backup';
import { emptySoundConfig, type SoundConfig } from './soundConfig';
import type { Workout } from './workout';

/**
 * Arquivo de um treino compartilhável (`Nome.dmtabata`).
 * Leva a estrutura do treino e os sons dele que existem em qualquer instalação
 * (embutidos e pacote pessoal). Sons importados/gravados ficam de fora.
 */
export const WORKOUT_FILE_VERSION = 1;
export const WORKOUT_FILE_EXTENSION = 'dmtabata';

export type PortableSounds = {
  sounds: Partial<Record<AlertSlot, SoundId>>;
  surpriseSounds?: SoundId[];
  surpriseChance?: number;
  backgroundMusicId?: SoundId;
  musicVolume?: number;
};

export type WorkoutFile = {
  app: 'dmtabata';
  kind: 'workout';
  version: number;
  exportedAt: number;
  workout: PortableWorkout;
  sounds: PortableSounds | null;
};

type PortableWorkout = {
  name: string;
  type: Workout['type'];
  prepareSec: number;
  cooldownSec: number;
  restBetweenCyclesSec: number;
  cycles: {
    name: string;
    repeatCount: number;
    defaultWorkSec: number;
    defaultRestSec: number;
    skipLastRest: boolean;
    items: {
      label: string;
      workSec: number | null;
      restSec: number | null;
      workSoundId: SoundId | null;
      restSoundId: SoundId | null;
    }[];
  }[];
};

export type BuiltWorkoutFile = { file: WorkoutFile; droppedSounds: number };

/** Monta o arquivo; `isPortable` diz se um som existe em qualquer instalação. */
export function buildWorkoutFile(
  workout: Workout,
  config: SoundConfig | null,
  isPortable: (id: SoundId) => boolean,
  now: number = Date.now(),
): BuiltWorkoutFile {
  let droppedSounds = 0;
  const keep = (id: SoundId | null): SoundId | null => {
    if (!id) return null;
    if (id === SILENT_SOUND_ID || isPortable(id)) return id;
    droppedSounds++;
    return null;
  };

  const portable: PortableWorkout = {
    name: workout.name,
    type: workout.type,
    prepareSec: workout.prepareSec,
    cooldownSec: workout.cooldownSec,
    restBetweenCyclesSec: workout.restBetweenCyclesSec,
    cycles: workout.cycles.map((c) => ({
      name: c.name,
      repeatCount: c.repeatCount,
      defaultWorkSec: c.defaultWorkSec,
      defaultRestSec: c.defaultRestSec,
      skipLastRest: c.skipLastRest,
      items: c.items.map((i) => ({
        label: i.label,
        workSec: i.workSec,
        restSec: i.restSec,
        workSoundId: keep(i.workSoundId),
        restSoundId: keep(i.restSoundId),
      })),
    })),
  };

  let sounds: PortableSounds | null = null;
  if (config) {
    const slots: Partial<Record<AlertSlot, SoundId>> = {};
    for (const slot of ALERT_SLOTS) {
      const id = keep(config.sounds[slot]);
      if (id) slots[slot] = id;
    }
    const surprise =
      config.surpriseSounds === null
        ? undefined
        : config.surpriseSounds.map(keep).filter((id): id is SoundId => !!id);
    const music = keep(config.backgroundMusicId) ?? undefined;
    sounds = {
      sounds: slots,
      ...(surprise ? { surpriseSounds: surprise } : {}),
      ...(config.surpriseChance !== null ? { surpriseChance: config.surpriseChance } : {}),
      ...(music ? { backgroundMusicId: music } : {}),
      ...(config.musicVolume !== null ? { musicVolume: config.musicVolume } : {}),
    };
  }

  return {
    file: {
      app: 'dmtabata',
      kind: 'workout',
      version: WORKOUT_FILE_VERSION,
      exportedAt: now,
      workout: portable,
      sounds,
    },
    droppedSounds,
  };
}

export const serializeWorkoutFile = (file: WorkoutFile) => JSON.stringify(file, null, 2);

/** Nome do arquivo a partir do nome do treino ("Boxe Sequenciado" → "boxe-sequenciado.dmtabata"). */
export function workoutFileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'treino'}.${WORKOUT_FILE_EXTENSION}`;
}

export type ParsedWorkoutFile =
  | {
      ok: true;
      workout: Workout;
      /** Configuração de sons própria do treino (sem id final), ou null. */
      sounds: Omit<SoundConfig, 'id'> | null;
      /** Sons citados no arquivo que não existem neste aparelho. */
      missingSounds: number;
    }
  | { ok: false; reason: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Lê um arquivo de treino (texto ou objeto já decodificado). */
export function parseWorkoutFile(
  input: string | unknown,
  options: { knownSoundIds: Set<string>; now?: number },
): ParsedWorkoutFile {
  const now = options.now ?? Date.now();
  let data: unknown = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, reason: 'Arquivo não é um treino do DMTabata.' };
    }
  }
  if (!isObject(data) || data.app !== 'dmtabata' || data.kind !== 'workout') {
    return { ok: false, reason: 'Arquivo não é um treino do DMTabata.' };
  }
  if (typeof data.version === 'number' && data.version > WORKOUT_FILE_VERSION) {
    return { ok: false, reason: 'Treino criado por uma versão mais nova do app.' };
  }

  let missingSounds = 0;
  const sound = (v: unknown): string | null => {
    if (typeof v !== 'string' || !v) return null;
    if (v === SILENT_SOUND_ID || options.knownSoundIds.has(v)) return v;
    missingSounds++;
    return null;
  };

  const workout = normalizeWorkout(data.workout, sound, now);
  if (!workout) return { ok: false, reason: 'O treino do arquivo está incompleto ou inválido.' };

  let sounds: Omit<SoundConfig, 'id'> | null = null;
  if (isObject(data.sounds)) {
    const raw = data.sounds;
    const base = emptySoundConfig('tmp', 'Sons do treino');
    const slots = isObject(raw.sounds) ? raw.sounds : {};
    for (const slot of ALERT_SLOTS) base.sounds[slot] = sound(slots[slot]);
    if (Array.isArray(raw.surpriseSounds)) {
      base.surpriseSounds = raw.surpriseSounds.map(sound).filter((id): id is string => !!id);
    }
    if (typeof raw.surpriseChance === 'number') base.surpriseChance = raw.surpriseChance;
    base.backgroundMusicId = sound(raw.backgroundMusicId);
    if (typeof raw.musicVolume === 'number') base.musicVolume = raw.musicVolume;
    const { id: _id, ...rest } = base;
    sounds = rest;
  }

  return { ok: true, workout, sounds, missingSounds };
}

/**
 * Quando o sistema abre o app com um arquivo de treino (ex.: tocado no WhatsApp),
 * a "url" é o caminho do arquivo. Devolve a rota de importação, ou null se não for um treino.
 */
export function importRouteForPath(path: string): string | null {
  const lower = path.toLowerCase().split('?')[0];
  const isFile = lower.startsWith('file://') || lower.startsWith('/');
  if (!isFile || !lower.endsWith(`.${WORKOUT_FILE_EXTENSION}`)) return null;
  return `/import?uri=${encodeURIComponent(path)}`;
}
