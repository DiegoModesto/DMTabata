import { createId } from './id';

export type WorkoutType = 'tabata' | 'hiit' | 'emom' | 'amrap' | 'circuit' | 'custom';

/**
 * Exercício dentro de um ciclo. `null` em workSec/restSec = herda o padrão do ciclo;
 * `null` em workSoundId/restSoundId = usa o som do treino/global.
 */
export type CycleItem = {
  id: string;
  label: string;
  workSec: number | null;
  restSec: number | null;
  workSoundId: string | null;
  restSoundId: string | null;
};

export type Cycle = {
  id: string;
  name: string;
  repeatCount: number;
  defaultWorkSec: number;
  defaultRestSec: number;
  /** Se verdadeiro, o descanso do último exercício da última repetição é omitido. */
  skipLastRest: boolean;
  items: CycleItem[];
};

export type Workout = {
  id: string;
  name: string;
  type: WorkoutType;
  prepareSec: number;
  cooldownSec: number;
  restBetweenCyclesSec: number;
  soundConfigId: string | null;
  color: string | null;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  cycles: Cycle[];
};

export const DEFAULTS = {
  prepareSec: 10,
  cooldownSec: 0,
  restBetweenCyclesSec: 60,
  workSec: 30,
  restSec: 10,
  itemsPerCycle: 5,
} as const;

export const LIMITS = {
  nameMaxLength: 60,
  minWorkSec: 1,
  maxPhaseSec: 3600,
  maxPrepareSec: 300,
  minRepeat: 1,
  maxRepeat: 99,
  maxItemsPerCycle: 50,
  maxCycles: 30,
} as const;

// ---------- Tempos efetivos ----------

export const effectiveWorkSec = (cycle: Cycle, item: CycleItem): number =>
  item.workSec ?? cycle.defaultWorkSec;

export const effectiveRestSec = (cycle: Cycle, item: CycleItem): number =>
  item.restSec ?? cycle.defaultRestSec;

export const isItemOverridden = (item: CycleItem): boolean =>
  item.workSec !== null || item.restSec !== null;

export const hasItemSounds = (item: CycleItem): boolean =>
  item.workSoundId !== null || item.restSoundId !== null;

/**
 * Descanso efetivo após o item `itemIndex` na repetição `repeatIndex` (0-based).
 * Retorna 0 quando o descanso é omitido (último item da última repetição com skipLastRest).
 */
export function restAfterItem(cycle: Cycle, itemIndex: number, repeatIndex: number): number {
  const isLastItem = itemIndex === cycle.items.length - 1;
  const isLastRepeat = repeatIndex === cycle.repeatCount - 1;
  if (isLastItem && isLastRepeat && cycle.skipLastRest) return 0;
  return effectiveRestSec(cycle, cycle.items[itemIndex]);
}

/** Duração de uma repetição do ciclo (sem o descanso entre ciclos). */
export function cycleDurationSec(cycle: Cycle): number {
  let total = 0;
  for (let r = 0; r < cycle.repeatCount; r++) {
    cycle.items.forEach((item, i) => {
      total += effectiveWorkSec(cycle, item) + restAfterItem(cycle, i, r);
    });
  }
  return total;
}

export type WorkoutTotals = {
  totalSec: number;
  workSec: number;
  restSec: number;
  prepareSec: number;
  cooldownSec: number;
  cycleRestSec: number;
  exerciseCount: number;
  cycleDurationsSec: number[];
};

export function workoutTotals(workout: Workout): WorkoutTotals {
  let workSec = 0;
  let restSec = 0;
  let exerciseCount = 0;
  const cycleDurationsSec = workout.cycles.map((cycle) => {
    for (let r = 0; r < cycle.repeatCount; r++) {
      cycle.items.forEach((item, i) => {
        workSec += effectiveWorkSec(cycle, item);
        restSec += restAfterItem(cycle, i, r);
      });
    }
    exerciseCount += cycle.items.length;
    return cycleDurationSec(cycle);
  });
  const cycleRestSec = Math.max(0, workout.cycles.length - 1) * workout.restBetweenCyclesSec;
  const prepareSec = workout.cycles.length ? workout.prepareSec : 0;
  const cooldownSec = workout.cycles.length ? workout.cooldownSec : 0;
  return {
    totalSec: prepareSec + workSec + restSec + cycleRestSec + cooldownSec,
    workSec,
    restSec,
    prepareSec,
    cooldownSec,
    cycleRestSec,
    exerciseCount,
    cycleDurationsSec,
  };
}

// ---------- Fábricas ----------

export function createItem(label: string, overrides: Partial<CycleItem> = {}): CycleItem {
  return {
    id: createId(),
    label,
    workSec: null,
    restSec: null,
    workSoundId: null,
    restSoundId: null,
    ...overrides,
  };
}

export function createCycle(
  input: {
    name?: string;
    itemCount?: number;
    workSec?: number;
    restSec?: number;
    repeatCount?: number;
    labels?: string[];
  } = {},
): Cycle {
  const labels =
    input.labels ??
    Array.from(
      { length: input.itemCount ?? DEFAULTS.itemsPerCycle },
      (_, i) => `Exercício ${i + 1}`,
    );
  return {
    id: createId(),
    name: input.name ?? 'Ciclo 1',
    repeatCount: input.repeatCount ?? 1,
    defaultWorkSec: input.workSec ?? DEFAULTS.workSec,
    defaultRestSec: input.restSec ?? DEFAULTS.restSec,
    skipLastRest: true,
    items: labels.map((label) => createItem(label)),
  };
}

export function createWorkout(
  input: Partial<Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>> = {},
  now: number = Date.now(),
): Workout {
  return {
    id: createId(),
    name: '',
    type: 'custom',
    prepareSec: DEFAULTS.prepareSec,
    cooldownSec: DEFAULTS.cooldownSec,
    restBetweenCyclesSec: DEFAULTS.restBetweenCyclesSec,
    soundConfigId: null,
    color: null,
    favorite: false,
    cycles: [createCycle()],
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}

/** Tabata clássico: 8 × (20s trabalho / 10s descanso). */
export function createTabataWorkout(now: number = Date.now()): Workout {
  return createWorkout(
    {
      name: 'Tabata clássico',
      type: 'tabata',
      cycles: [
        {
          ...createCycle({ name: 'Tabata', labels: ['Exercício'], workSec: 20, restSec: 10 }),
          repeatCount: 8,
        },
      ],
    },
    now,
  );
}

/** Cópia profunda com novos ids (para duplicar treinos). */
export function duplicateWorkout(workout: Workout, now: number = Date.now()): Workout {
  return {
    ...workout,
    id: createId(),
    name: `${workout.name} (cópia)`.slice(0, LIMITS.nameMaxLength),
    favorite: false,
    createdAt: now,
    updatedAt: now,
    cycles: workout.cycles.map((cycle) => ({
      ...cycle,
      id: createId(),
      items: cycle.items.map((item) => ({ ...item, id: createId() })),
    })),
  };
}
