import { findPhaseIndex, type PhaseKind, type Timeline } from './timeline';

/**
 * Registro do que aconteceu em cada fase durante o treino.
 *
 * O tempo realizado é medido pelo **tempo decorrido do motor** (que já desconta
 * pausas), distribuído exatamente entre as fases atravessadas — sem erro de
 * granularidade dos ticks. Pausas são medidas em tempo de relógio.
 */
export type PhaseLog = {
  index: number;
  kind: PhaseKind;
  label: string;
  cycleIndex: number;
  itemIndex: number;
  plannedMs: number;
  actualMs: number;
  skipped: boolean;
};

export type SessionLog = {
  phases: PhaseLog[];
  pausedMs: number;
};

/** O que o gravador precisa saber de cada instante (subconjunto do TimerSnapshot). */
export type RecorderSample = {
  status: 'idle' | 'running' | 'paused' | 'finished';
  elapsedMs: number;
  phaseIndex: number;
};

/** Tolerância para considerar uma fase concluída (arredondamentos de tick). */
export const COMPLETION_TOLERANCE_MS = 250;

export function createSessionRecorder(timeline: Timeline) {
  const phases: PhaseLog[] = timeline.phases.map((p) => ({
    index: p.index,
    kind: p.kind,
    label: p.label,
    cycleIndex: p.cycleIndex,
    itemIndex: p.itemIndex,
    plannedMs: p.durationMs,
    actualMs: 0,
    skipped: false,
  }));
  let pausedMs = 0;
  let last: { sample: RecorderSample; now: number } | null = null;

  /** Soma o intervalo [from, to) de tempo decorrido às fases que ele cobre. */
  function distribute(from: number, to: number) {
    if (to <= from) return;
    let i = findPhaseIndex(timeline, from);
    if (i < 0) return;
    while (i < timeline.phases.length) {
      const phase = timeline.phases[i];
      const end = phase.startOffsetMs + phase.durationMs;
      const overlap = Math.min(to, end) - Math.max(from, phase.startOffsetMs);
      if (overlap > 0) phases[i].actualMs += overlap;
      if (end >= to) break;
      i++;
    }
  }

  return {
    /** Registra a evolução desde a última amostra (avanço contínuo do relógio). */
    observe(sample: RecorderSample, now: number) {
      if (last) {
        const prev = last.sample;
        if (prev.status === 'paused') pausedMs += Math.max(0, now - last.now);
        if (prev.status === 'running' || sample.status === 'finished') {
          distribute(prev.elapsedMs, sample.elapsedMs);
        }
      }
      last = { sample, now };
    },

    /** Recomeça a medição a partir desta amostra (após pular/voltar, que saltam o tempo). */
    rebase(sample: RecorderSample, now: number) {
      last = { sample, now };
    },

    markSkipped(phaseIndex: number) {
      if (phases[phaseIndex]) phases[phaseIndex].skipped = true;
    },

    log(): SessionLog {
      return { phases: phases.map((p) => ({ ...p })), pausedMs };
    },
  };
}

export type SessionRecorder = ReturnType<typeof createSessionRecorder>;

export type SessionSummary = {
  plannedMs: number;
  actualMs: number;
  workMs: number;
  restMs: number;
  pausedMs: number;
  phasesTotal: number;
  phasesCompleted: number;
  phasesSkipped: number;
  /** 0..1 */
  completionRate: number;
  skippedExercises: string[];
};

export const isPhaseCompleted = (p: PhaseLog) =>
  p.actualMs >= p.plannedMs - COMPLETION_TOLERANCE_MS;

export function summarizeSession(log: SessionLog): SessionSummary {
  const completed = log.phases.filter(isPhaseCompleted);
  const skipped = log.phases.filter((p) => p.skipped && !isPhaseCompleted(p));
  const sum = (kinds: PhaseKind[]) =>
    log.phases.filter((p) => kinds.includes(p.kind)).reduce((acc, p) => acc + p.actualMs, 0);
  return {
    plannedMs: log.phases.reduce((acc, p) => acc + p.plannedMs, 0),
    actualMs: log.phases.reduce((acc, p) => acc + p.actualMs, 0),
    workMs: sum(['work']),
    restMs: sum(['rest', 'cycleRest', 'cooldown']),
    pausedMs: log.pausedMs,
    phasesTotal: log.phases.length,
    phasesCompleted: completed.length,
    phasesSkipped: skipped.length,
    completionRate: log.phases.length ? completed.length / log.phases.length : 0,
    skippedExercises: skipped.filter((p) => p.kind === 'work').map((p) => p.label),
  };
}
