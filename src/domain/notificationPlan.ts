import { SILENT_SOUND_ID, type AlertSettings } from './alerts';
import { isBuiltinSoundId } from './sounds';
import type { Phase, Timeline } from './timeline';

/**
 * Plano de notificações locais para quando o app vai para segundo plano:
 * uma notificação por troca de fase (e uma no fim), com o som configurado.
 *
 * iOS limita a 64 notificações pendentes; agendamos no máximo `limit`.
 */
export type PlannedNotification = {
  /** Epoch ms em que deve disparar. */
  fireAt: number;
  title: string;
  body: string;
  /** Arquivo de som empacotado (ex.: "go.wav"), 'default' ou null (sem som). */
  sound: string | null;
};

export const NOTIFICATION_LIMIT = 60;

const PHASE_TITLES: Record<Phase['kind'], string> = {
  prepare: 'Preparar',
  work: 'Trabalho',
  rest: 'Descanso',
  cycleRest: 'Descanso entre ciclos',
  cooldown: 'Desaquecimento',
};

/** Notificações só tocam sons empacotados; sons importados caem no som padrão do sistema. */
export function notificationSound(soundId: string | null): string | null {
  if (!soundId || soundId === SILENT_SOUND_ID) return null;
  return isBuiltinSoundId(soundId) ? `${soundId}.wav` : 'default';
}

function soundForPhase(phase: Phase, settings: AlertSettings): string | null {
  if (settings.volume <= 0) return null;
  if (phase.soundOverride) return notificationSound(phase.soundOverride);
  switch (phase.kind) {
    case 'work':
      return notificationSound(settings.sounds.workStart);
    case 'rest':
    case 'cooldown':
      return notificationSound(settings.sounds.restStart);
    case 'cycleRest':
      return notificationSound(settings.sounds.cycleEnd ?? settings.sounds.restStart);
    case 'prepare':
      return null;
  }
}

function bodyForPhase(phase: Phase): string {
  if (phase.kind === 'work') {
    const reps = phase.totalRepeats > 1 ? ` · ${phase.repeat}/${phase.totalRepeats}` : '';
    return `${phase.label} (${Math.round(phase.durationMs / 1000)}s)${reps}`;
  }
  return phase.nextWorkLabel ? `Próximo: ${phase.nextWorkLabel}` : 'Último trecho do treino';
}

export function planNotifications(input: {
  timeline: Timeline;
  elapsedMs: number;
  /** Epoch ms correspondente a `elapsedMs`. */
  nowEpoch: number;
  settings: AlertSettings;
  workoutName: string;
  limit?: number;
}): PlannedNotification[] {
  const { timeline, elapsedMs, nowEpoch, settings, workoutName, limit = NOTIFICATION_LIMIT } = input;
  if (limit <= 0 || elapsedMs >= timeline.totalMs) return [];

  const upcoming: PlannedNotification[] = timeline.phases
    .filter((p) => p.startOffsetMs > elapsedMs)
    .map((p) => ({
      fireAt: nowEpoch + (p.startOffsetMs - elapsedMs),
      title: PHASE_TITLES[p.kind],
      body: bodyForPhase(p),
      sound: soundForPhase(p, settings),
    }));

  const finish: PlannedNotification = {
    fireAt: nowEpoch + (timeline.totalMs - elapsedMs),
    title: 'Treino concluído!',
    body: workoutName,
    sound: settings.volume > 0 ? notificationSound(settings.sounds.workoutEnd) : null,
  };

  // Se não couber tudo, reserva a última vaga para o aviso de fim.
  return upcoming.length + 1 <= limit
    ? [...upcoming, finish]
    : [...upcoming.slice(0, limit - 1), finish];
}
