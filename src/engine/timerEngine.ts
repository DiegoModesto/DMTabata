import { findPhaseIndex, type Phase, type Timeline } from '@/domain/timeline';

/**
 * Motor do temporizador — máquina de estados pura.
 *
 * O tempo decorrido nunca é "contado" por ticks: é sempre derivado de timestamps
 * (`now - startedAt - pausedMs + offsetMs`). Assim não há deriva acumulada e, ao
 * voltar do background, o estado correto é recalculado imediatamente.
 * `offsetMs` acumula os saltos de "pular"/"voltar".
 */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type TimerState = {
  status: TimerStatus;
  startedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
  offsetMs: number;
  /** Tempo decorrido congelado ao terminar. */
  finalElapsedMs: number | null;
  /** Verdadeiro se o usuário parou antes do fim. */
  stoppedEarly: boolean;
};

export type TimerSnapshot = {
  status: TimerStatus;
  elapsedMs: number;
  phaseIndex: number;
  phase: Phase | null;
  phaseElapsedMs: number;
  phaseRemainingMs: number;
  totalRemainingMs: number;
  /** 0..1 */
  phaseProgress: number;
  /** 0..1 */
  totalProgress: number;
};

export const initialTimerState: TimerState = {
  status: 'idle',
  startedAt: null,
  pausedAt: null,
  pausedMs: 0,
  offsetMs: 0,
  finalElapsedMs: null,
  stoppedEarly: false,
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function elapsedMs(state: TimerState, now: number, timeline: Timeline): number {
  let raw: number;
  switch (state.status) {
    case 'idle':
      return 0;
    case 'finished':
      return state.finalElapsedMs ?? timeline.totalMs;
    case 'paused':
      raw = (state.pausedAt ?? now) - (state.startedAt ?? now) - state.pausedMs + state.offsetMs;
      break;
    case 'running':
      raw = now - (state.startedAt ?? now) - state.pausedMs + state.offsetMs;
      break;
  }
  return clamp(raw, 0, timeline.totalMs);
}

export function start(state: TimerState, now: number, timeline: Timeline): TimerState {
  if (state.status !== 'idle') return state;
  if (timeline.phases.length === 0) {
    return { ...state, status: 'finished', startedAt: now, finalElapsedMs: 0 };
  }
  return { ...initialTimerState, status: 'running', startedAt: now };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', pausedAt: now };
}

export function resume(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused' || state.pausedAt === null) return state;
  return {
    ...state,
    status: 'running',
    pausedMs: state.pausedMs + (now - state.pausedAt),
    pausedAt: null,
  };
}

/** Verifica se o tempo acabou e congela o estado como `finished`. */
export function tick(state: TimerState, now: number, timeline: Timeline): TimerState {
  if (state.status !== 'running') return state;
  const elapsed = elapsedMs(state, now, timeline);
  if (elapsed >= timeline.totalMs) {
    return { ...state, status: 'finished', finalElapsedMs: timeline.totalMs };
  }
  return state;
}

function jumpTo(state: TimerState, now: number, timeline: Timeline, targetMs: number): TimerState {
  const current = elapsedMs(state, now, timeline);
  const next: TimerState = { ...state, offsetMs: state.offsetMs + (targetMs - current) };
  return tick(next, now, timeline);
}

/** Pula para o início da próxima fase (ou termina, se for a última). */
export function skip(state: TimerState, now: number, timeline: Timeline): TimerState {
  if (state.status !== 'running' && state.status !== 'paused') return state;
  const index = findPhaseIndex(timeline, elapsedMs(state, now, timeline));
  if (index < 0) return state;
  const nextPhase = timeline.phases[index + 1];
  if (!nextPhase) {
    return { ...state, status: 'finished', finalElapsedMs: timeline.totalMs, pausedAt: null };
  }
  return jumpTo(state, now, timeline, nextPhase.startOffsetMs);
}

/** Tolerância para "voltar": dentro dela, volta para a fase anterior; depois, reinicia a atual. */
export const BACK_THRESHOLD_MS = 2000;

export function back(state: TimerState, now: number, timeline: Timeline): TimerState {
  if (state.status !== 'running' && state.status !== 'paused') return state;
  const elapsed = elapsedMs(state, now, timeline);
  const index = findPhaseIndex(timeline, elapsed);
  if (index < 0) return state;
  const phase = timeline.phases[index];
  const intoPhase = elapsed - phase.startOffsetMs;
  const target =
    intoPhase > BACK_THRESHOLD_MS || index === 0
      ? phase.startOffsetMs
      : timeline.phases[index - 1].startOffsetMs;
  return jumpTo(state, now, timeline, target);
}

export function stop(state: TimerState, now: number, timeline: Timeline): TimerState {
  if (state.status === 'idle' || state.status === 'finished') return state;
  return {
    ...state,
    status: 'finished',
    finalElapsedMs: elapsedMs(state, now, timeline),
    stoppedEarly: true,
    pausedAt: null,
  };
}

export function snapshot(state: TimerState, now: number, timeline: Timeline): TimerSnapshot {
  const elapsed = elapsedMs(state, now, timeline);
  const index = state.status === 'finished' ? -1 : findPhaseIndex(timeline, elapsed);
  const phase = index >= 0 ? timeline.phases[index] : null;
  const phaseElapsed = phase ? elapsed - phase.startOffsetMs : 0;
  const phaseRemaining = phase ? phase.durationMs - phaseElapsed : 0;
  return {
    status: state.status,
    elapsedMs: elapsed,
    phaseIndex: index,
    phase,
    phaseElapsedMs: phaseElapsed,
    phaseRemainingMs: phaseRemaining,
    totalRemainingMs: Math.max(0, timeline.totalMs - elapsed),
    phaseProgress: phase && phase.durationMs > 0 ? phaseElapsed / phase.durationMs : 0,
    totalProgress: timeline.totalMs > 0 ? elapsed / timeline.totalMs : 1,
  };
}

// ---------- Eventos para alertas ----------

export type TimerEvent =
  | { type: 'phaseStarted'; phase: Phase }
  | { type: 'countdown'; secondsLeft: number; phase: Phase }
  | { type: 'halfway'; phase: Phase }
  | { type: 'finished'; stoppedEarly: boolean };

export type EventOptions = {
  countdownFrom: number;
  halfwayAlert: boolean;
};

/** Metade só é anunciada em fases de trabalho com pelo menos este tamanho. */
export const HALFWAY_MIN_PHASE_MS = 10_000;

/**
 * Compara dois snapshots consecutivos e devolve os eventos que aconteceram entre eles.
 * Em saltos grandes (ex.: volta do background) só o evento mais recente de cada tipo é emitido,
 * evitando uma rajada de sons atrasados.
 */
export function diffEvents(
  prev: TimerSnapshot | null,
  next: TimerSnapshot,
  options: EventOptions,
  stoppedEarly = false,
): TimerEvent[] {
  const events: TimerEvent[] = [];

  if (next.status === 'finished') {
    if (prev?.status !== 'finished') events.push({ type: 'finished', stoppedEarly });
    return events;
  }
  if (next.status !== 'running' || !next.phase) return events;

  const samePhase = prev?.phaseIndex === next.phaseIndex && prev.status !== 'idle';
  if (!samePhase) {
    events.push({ type: 'phaseStarted', phase: next.phase });
    return events;
  }

  const prevSec = Math.ceil(prev.phaseRemainingMs / 1000);
  const nextSec = Math.ceil(next.phaseRemainingMs / 1000);
  if (nextSec < prevSec && nextSec >= 1 && nextSec <= options.countdownFrom) {
    events.push({ type: 'countdown', secondsLeft: nextSec, phase: next.phase });
  }

  if (
    options.halfwayAlert &&
    next.phase.kind === 'work' &&
    next.phase.durationMs >= HALFWAY_MIN_PHASE_MS
  ) {
    const half = next.phase.durationMs / 2;
    if (prev.phaseElapsedMs < half && next.phaseElapsedMs >= half) {
      events.push({ type: 'halfway', phase: next.phase });
    }
  }
  return events;
}
