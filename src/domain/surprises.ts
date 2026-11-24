import { SILENT_SOUND_ID, type SoundId } from './alerts';
import type { Timeline } from './timeline';

/**
 * Sons surpresa: durante o trabalho, em momentos sorteados, toca um som aleatório
 * de uma lista escolhida pelo usuário (chicote, risada, trilha de luta…).
 */
export const SURPRISE_RULES = {
  /** Só sorteia em fases de trabalho com pelo menos esta duração. */
  minPhaseMs: 6_000,
  /** Janela do sorteio dentro da fase (fração da duração), longe do início e da contagem final. */
  windowStart: 0.2,
  windowEnd: 0.6,
  /** Nunca antes disso após o início do trabalho (deixa o som de início tocar). */
  minOffsetMs: 2_000,
  defaultChance: 0.3,
  maxSounds: 30,
} as const;

export type SurpriseSettings = {
  /** Lista de sons sorteáveis (vazia = recurso desligado). */
  surpriseSounds: SoundId[];
  /** Probabilidade (0..1) de cada fase de trabalho ganhar um som surpresa. */
  surpriseChance: number;
};

export type Surprise = {
  phaseIndex: number;
  /** Momento absoluto no treino (ms desde o início, como `elapsedMs`). */
  atMs: number;
  soundId: SoundId;
};

/** Normaliza a lista: sem duplicados, sem "silencioso", com limite de tamanho. */
export function cleanSurprisePool(ids: SoundId[]): SoundId[] {
  return [...new Set(ids.filter((id) => !!id && id !== SILENT_SOUND_ID))].slice(
    0,
    SURPRISE_RULES.maxSounds,
  );
}

/**
 * Sorteia, de uma vez, quando e qual som surpresa toca em cada fase de trabalho.
 * `random` é injetável para testes (padrão: Math.random). Evita repetir o mesmo som
 * duas vezes seguidas quando há mais de uma opção.
 */
export function planSurprises(
  timeline: Timeline,
  settings: SurpriseSettings,
  random: () => number = Math.random,
): Surprise[] {
  const pool = cleanSurprisePool(settings.surpriseSounds);
  const chance = Math.min(1, Math.max(0, settings.surpriseChance));
  if (pool.length === 0 || chance === 0) return [];

  const plan: Surprise[] = [];
  let lastSound: SoundId | null = null;
  for (const phase of timeline.phases) {
    if (phase.kind !== 'work' || phase.durationMs < SURPRISE_RULES.minPhaseMs) continue;
    if (random() >= chance) continue;

    const from = Math.max(
      SURPRISE_RULES.minOffsetMs,
      phase.durationMs * SURPRISE_RULES.windowStart,
    );
    const to = Math.max(from, phase.durationMs * SURPRISE_RULES.windowEnd);
    const offset = Math.round(from + (to - from) * random());

    const options = pool.length > 1 ? pool.filter((id) => id !== lastSound) : pool;
    const soundId = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
    lastSound = soundId;
    plan.push({ phaseIndex: phase.index, atMs: phase.startOffsetMs + offset, soundId });
  }
  return plan;
}

/**
 * Surpresas cujo momento foi cruzado entre dois instantes da mesma fase, com o treino
 * correndo. Saltos (pular/voltar) não disparam surpresas de fases atravessadas.
 */
export function dueSurprises(
  plan: Surprise[],
  prev: { elapsedMs: number; phaseIndex: number } | null,
  next: { elapsedMs: number; phaseIndex: number; status: string },
): Surprise[] {
  if (!prev || next.status !== 'running' || prev.phaseIndex !== next.phaseIndex) return [];
  return plan.filter(
    (s) => s.phaseIndex === next.phaseIndex && prev.elapsedMs < s.atMs && next.elapsedMs >= s.atMs,
  );
}
