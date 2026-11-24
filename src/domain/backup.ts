import { createId } from './id';
import { validateWorkout } from './validation';
import { DEFAULTS, LIMITS, type CycleItem, type Workout, type WorkoutType } from './workout';
import { isWorkoutType } from './templates';

export const BACKUP_VERSION = 1;

export type Backup = {
  app: 'dmtabata';
  version: number;
  exportedAt: number;
  workouts: Workout[];
};

export function buildBackup(workouts: Workout[], now: number = Date.now()): Backup {
  return { app: 'dmtabata', version: BACKUP_VERSION, exportedAt: now, workouts };
}

export const serializeBackup = (backup: Backup) => JSON.stringify(backup, null, 2);

export type ParsedBackup =
  { ok: true; workouts: Workout[]; skipped: number } | { ok: false; reason: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const nullableNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Lê um backup e devolve treinos prontos para salvar:
 * - ids novos (importar duas vezes não sobrescreve nada);
 * - sons por exercício só são mantidos se existirem neste aparelho;
 * - configurações de som próprias não são importadas (voltam ao global);
 * - treinos inválidos são ignorados e contados em `skipped`.
 */
export function parseBackup(
  text: string,
  options: { knownSoundIds: Set<string>; now?: number },
): ParsedBackup {
  const now = options.now ?? Date.now();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Arquivo não é um JSON válido.' };
  }
  if (!isObject(data) || data.app !== 'dmtabata' || !Array.isArray(data.workouts)) {
    return { ok: false, reason: 'Este arquivo não é um backup do DMTabata.' };
  }
  if (num(data.version, 0) > BACKUP_VERSION) {
    return { ok: false, reason: 'Backup criado por uma versão mais nova do app.' };
  }

  const sound = (v: unknown) => {
    const id = typeof v === 'string' ? v : null;
    return id && options.knownSoundIds.has(id) ? id : null;
  };

  const workouts: Workout[] = [];
  let skipped = 0;
  for (const raw of data.workouts) {
    if (!isObject(raw) || !Array.isArray(raw.cycles)) {
      skipped++;
      continue;
    }
    const workout: Workout = {
      id: createId(),
      name: str(raw.name).slice(0, 60),
      type: (isWorkoutType(raw.type) ? raw.type : 'custom') as WorkoutType,
      prepareSec: Math.max(LIMITS.minPrepareSec, num(raw.prepareSec, DEFAULTS.prepareSec)),
      cooldownSec: num(raw.cooldownSec, 0),
      restBetweenCyclesSec: num(raw.restBetweenCyclesSec, 60),
      soundConfigId: null,
      color: null,
      favorite: raw.favorite === true,
      createdAt: now,
      updatedAt: now,
      cycles: raw.cycles.filter(isObject).map((c) => ({
        id: createId(),
        name: str(c.name, 'Ciclo'),
        repeatCount: num(c.repeatCount, 1),
        defaultWorkSec: num(c.defaultWorkSec, 30),
        defaultRestSec: num(c.defaultRestSec, 10),
        skipLastRest: c.skipLastRest !== false,
        items: (Array.isArray(c.items) ? c.items : []).filter(isObject).map((i): CycleItem => ({
          id: createId(),
          label: str(i.label, 'Exercício'),
          workSec: nullableNum(i.workSec),
          restSec: nullableNum(i.restSec),
          workSoundId: sound(i.workSoundId),
          restSoundId: sound(i.restSoundId),
        })),
      })),
    };
    if (validateWorkout(workout).length) skipped++;
    else workouts.push(workout);
  }
  return { ok: true, workouts, skipped };
}
