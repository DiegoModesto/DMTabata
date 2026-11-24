import { effectiveWorkSec, restAfterItem, type Workout } from './workout';

export type PhaseKind = 'prepare' | 'work' | 'rest' | 'cycleRest' | 'cooldown';

export type Phase = {
  index: number;
  kind: PhaseKind;
  durationMs: number;
  /** Início relativo ao começo do treino. */
  startOffsetMs: number;
  /** Nome do exercício (work/rest) ou rótulo da fase. */
  label: string;
  cycleIndex: number;
  totalCycles: number;
  cycleName: string;
  itemIndex: number;
  totalItems: number;
  repeat: number;
  totalRepeats: number;
  /** Próximo exercício a ser feito (para "Próximo: X"). */
  nextWorkLabel: string | null;
};

export type Timeline = {
  phases: Phase[];
  totalMs: number;
};

type Draft = Omit<Phase, 'index' | 'startOffsetMs' | 'nextWorkLabel'>;

/**
 * "Compila" um treino em uma lista linear de fases com início/duração absolutos.
 * Fases de duração zero são omitidas.
 */
export function compileTimeline(workout: Workout): Timeline {
  const drafts: Draft[] = [];
  const totalCycles = workout.cycles.length;
  const nonEmptyCycles = workout.cycles.filter((c) => c.items.length > 0);
  if (nonEmptyCycles.length === 0) return { phases: [], totalMs: 0 };

  const base = (cycleIndex: number) => ({
    cycleIndex,
    totalCycles,
    cycleName: workout.cycles[cycleIndex]?.name ?? '',
  });

  drafts.push({
    kind: 'prepare',
    durationMs: workout.prepareSec * 1000,
    label: 'Preparar',
    ...base(0),
    itemIndex: 0,
    totalItems: workout.cycles[0].items.length,
    repeat: 1,
    totalRepeats: workout.cycles[0].repeatCount,
  });

  workout.cycles.forEach((cycle, c) => {
    if (cycle.items.length === 0) return;
    for (let r = 0; r < cycle.repeatCount; r++) {
      cycle.items.forEach((item, i) => {
        const shared = {
          ...base(c),
          itemIndex: i,
          totalItems: cycle.items.length,
          repeat: r + 1,
          totalRepeats: cycle.repeatCount,
        };
        drafts.push({
          kind: 'work',
          durationMs: effectiveWorkSec(cycle, item) * 1000,
          label: item.label,
          ...shared,
        });
        drafts.push({
          kind: 'rest',
          durationMs: restAfterItem(cycle, i, r) * 1000,
          label: 'Descanso',
          ...shared,
        });
      });
    }
    const isLastCycle = c === totalCycles - 1;
    if (!isLastCycle) {
      drafts.push({
        kind: 'cycleRest',
        durationMs: workout.restBetweenCyclesSec * 1000,
        label: 'Descanso entre ciclos',
        ...base(c),
        itemIndex: cycle.items.length - 1,
        totalItems: cycle.items.length,
        repeat: cycle.repeatCount,
        totalRepeats: cycle.repeatCount,
      });
    }
  });

  const last = workout.cycles[totalCycles - 1];
  drafts.push({
    kind: 'cooldown',
    durationMs: workout.cooldownSec * 1000,
    label: 'Desaquecimento',
    ...base(totalCycles - 1),
    itemIndex: Math.max(0, last.items.length - 1),
    totalItems: last.items.length,
    repeat: last.repeatCount,
    totalRepeats: last.repeatCount,
  });

  const kept = drafts.filter((d) => d.durationMs > 0);
  let offset = 0;
  const phases: Phase[] = kept.map((d, index) => {
    const phase: Phase = { ...d, index, startOffsetMs: offset, nextWorkLabel: null };
    offset += d.durationMs;
    return phase;
  });

  // "Próximo exercício": primeiro work estritamente depois da fase atual.
  let nextWork: string | null = null;
  for (let i = phases.length - 1; i >= 0; i--) {
    phases[i].nextWorkLabel = nextWork;
    if (phases[i].kind === 'work') nextWork = phases[i].label;
  }

  return { phases, totalMs: offset };
}

/** Índice da fase que contém `elapsedMs` (busca binária). Retorna -1 se terminou. */
export function findPhaseIndex(timeline: Timeline, elapsedMs: number): number {
  const { phases, totalMs } = timeline;
  if (phases.length === 0 || elapsedMs >= totalMs) return -1;
  if (elapsedMs <= 0) return 0;
  let lo = 0;
  let hi = phases.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (phases[mid].startOffsetMs <= elapsedMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
