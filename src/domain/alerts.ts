import type { TimerEvent } from '@/engine/timerEngine';

/** Momentos do treino em que um som pode tocar. */
export type AlertSlot = 'workStart' | 'restStart' | 'countdown' | 'cycleEnd' | 'workoutEnd' | 'halfway';

export const ALERT_SLOTS: AlertSlot[] = [
  'workStart',
  'restStart',
  'countdown',
  'cycleEnd',
  'workoutEnd',
  'halfway',
];

export type BuiltinSoundId =
  | 'beep'
  | 'beep-high'
  | 'double-beep'
  | 'whistle'
  | 'bell'
  | 'gong'
  | 'horn'
  | 'go'
  | 'rest'
  | 'finish';

/** Id de som: embutido ou importado pelo usuário (uuid). `null` = silencioso. */
export type SoundId = string;

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

export type AlertSettings = {
  sounds: Record<AlertSlot, SoundId | null>;
  countdownFrom: number;
  volume: number;
  hapticsEnabled: boolean;
  halfwayAlert: boolean;
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  sounds: {
    workStart: 'go',
    restStart: 'rest',
    countdown: 'beep',
    cycleEnd: 'bell',
    workoutEnd: 'finish',
    halfway: 'double-beep',
  },
  countdownFrom: 3,
  volume: 1,
  hapticsEnabled: true,
  halfwayAlert: false,
};

export type AlertCommand =
  | { type: 'sound'; soundId: SoundId; volume: number; slot: AlertSlot }
  | { type: 'haptic'; style: HapticStyle };

function slotForEvent(event: TimerEvent): AlertSlot | null {
  switch (event.type) {
    case 'phaseStarted':
      switch (event.phase.kind) {
        case 'work':
          return 'workStart';
        case 'rest':
        case 'cooldown':
          return 'restStart';
        case 'cycleRest':
          return 'cycleEnd';
        case 'prepare':
          return null;
      }
      return null;
    case 'countdown':
      return 'countdown';
    case 'halfway':
      return 'halfway';
    case 'finished':
      return event.stoppedEarly ? null : 'workoutEnd';
  }
}

const HAPTIC_BY_SLOT: Record<AlertSlot, HapticStyle> = {
  workStart: 'heavy',
  restStart: 'medium',
  countdown: 'light',
  cycleEnd: 'medium',
  workoutEnd: 'success',
  halfway: 'light',
};

/**
 * Traduz eventos do motor em comandos de som/vibração conforme a configuração.
 * Fim de ciclo sem som próprio usa o som de descanso.
 */
export function alertsForEvents(events: TimerEvent[], settings: AlertSettings): AlertCommand[] {
  const commands: AlertCommand[] = [];
  for (const event of events) {
    const slot = slotForEvent(event);
    if (!slot) continue;
    const soundId =
      settings.sounds[slot] ?? (slot === 'cycleEnd' ? settings.sounds.restStart : null);
    if (soundId && settings.volume > 0) {
      commands.push({ type: 'sound', soundId, volume: settings.volume, slot });
    }
    if (settings.hapticsEnabled) {
      commands.push({ type: 'haptic', style: HAPTIC_BY_SLOT[slot] });
    }
  }
  return commands;
}
