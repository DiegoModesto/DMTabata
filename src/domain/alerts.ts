import type { Phase } from '@/domain/timeline';
import type { TimerEvent } from '@/engine/timerEngine';

/** Momentos do treino em que um som pode tocar. */
export type AlertSlot =
  'prepareStart' | 'workStart' | 'restStart' | 'countdown' | 'cycleEnd' | 'workoutEnd' | 'halfway';

export const ALERT_SLOTS: AlertSlot[] = [
  'prepareStart',
  'workStart',
  'restStart',
  'countdown',
  'cycleEnd',
  'workoutEnd',
  'halfway',
];

export const ALERT_SLOT_LABELS: Record<AlertSlot, string> = {
  prepareStart: 'Início da preparação',
  workStart: 'Início do trabalho',
  restStart: 'Início do descanso',
  countdown: 'Contagem regressiva',
  cycleEnd: 'Fim do ciclo',
  workoutEnd: 'Fim do treino',
  halfway: 'Metade do trabalho',
};

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
  | 'finish'
  | 'ring-bell'
  | 'ring-bell-3'
  | 'clapper'
  | 'tick'
  | 'start-321'
  | 'alarm'
  | 'siren'
  | 'buzzer'
  | 'chime';

/** Id de som: embutido, importado pelo usuário (uuid) ou `SILENT_SOUND_ID`. */
export type SoundId = string;

/** Escolha explícita de "nenhum som" (diferente de `null`, que significa "herdar"). */
export const SILENT_SOUND_ID = 'silent';

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

export type AlertSettings = {
  /** Som efetivo por evento; `null` = sem som. */
  sounds: Record<AlertSlot, SoundId | null>;
  countdownFrom: number;
  /** 0..1 */
  volume: number;
  hapticsEnabled: boolean;
  halfwayAlert: boolean;
  voiceEnabled: boolean;
  voiceLang: string;
  announceNext: boolean;
  /** Abaixa (em vez de pausar) a música de outros apps durante os alertas. */
  duckMusic: boolean;
  /** Sons sorteados em momentos aleatórios do trabalho (vazio = desligado). */
  surpriseSounds: SoundId[];
  /** Chance (0..1) de cada fase de trabalho ganhar um som surpresa. */
  surpriseChance: number;
  /** Música em loop durante o treino; `null` = sem música. */
  backgroundMusicId: SoundId | null;
  /** Volume da música relativo ao volume dos alertas (0..1), sempre abaixo dos sons. */
  musicVolume: number;
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  sounds: {
    prepareStart: null,
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
  voiceEnabled: false,
  voiceLang: 'pt-BR',
  announceNext: true,
  duckMusic: true,
  surpriseSounds: [],
  surpriseChance: 0.3,
  backgroundMusicId: null,
  musicVolume: 0.35,
};

export type AlertCommand =
  | {
      type: 'sound';
      soundId: SoundId;
      volume: number;
      slot: AlertSlot | 'surprise';
      /** Canal exclusivo: um som novo no canal interrompe o anterior. */
      channel?: 'surprise';
    }
  | { type: 'stopChannel'; channel: 'surprise' }
  /** Música de fundo: começa em loop, pausa, retoma e para junto com o treino. */
  | { type: 'music'; action: 'start'; soundId: SoundId; volume: number }
  | { type: 'music'; action: 'pause' | 'resume' | 'stop' }
  | { type: 'haptic'; style: HapticStyle }
  | { type: 'speak'; text: string; lang: string };

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
          return 'prepareStart';
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
  prepareStart: 'light',
  workStart: 'heavy',
  restStart: 'medium',
  countdown: 'light',
  cycleEnd: 'medium',
  workoutEnd: 'success',
  halfway: 'light',
};

/** Frase falada (TTS) para o evento, se houver. */
export function speechForEvent(event: TimerEvent, settings: AlertSettings): string | null {
  if (!settings.voiceEnabled) return null;
  const next = (phase: Phase) =>
    settings.announceNext && phase.nextWorkLabel ? ` Próximo: ${phase.nextWorkLabel}.` : '';
  switch (event.type) {
    case 'phaseStarted': {
      const { phase } = event;
      switch (phase.kind) {
        case 'prepare':
          return `Prepare-se.${next(phase)}`;
        case 'work':
          return `Vai! ${phase.label}.`;
        case 'rest':
          return `Descanso.${next(phase)}`;
        case 'cycleRest':
          return `Fim do ${phase.cycleName}. Descanso.${next(phase)}`;
        case 'cooldown':
          return 'Desaquecimento.';
      }
      return null;
    }
    case 'halfway':
      return 'Metade.';
    case 'finished':
      return event.stoppedEarly ? null : 'Treino concluído!';
    case 'countdown':
      return null;
  }
}

/** Som do evento, considerando o som específico do exercício (se houver). */
function soundForEvent(event: TimerEvent, slot: AlertSlot, settings: AlertSettings) {
  if (event.type === 'phaseStarted' && event.phase.soundOverride) {
    return event.phase.soundOverride === SILENT_SOUND_ID ? null : event.phase.soundOverride;
  }
  return settings.sounds[slot] ?? (slot === 'cycleEnd' ? settings.sounds.restStart : null);
}

/**
 * Traduz eventos do motor em comandos de som, vibração e voz conforme a configuração.
 * Fim de ciclo sem som próprio usa o som de descanso.
 */
export function alertsForEvents(events: TimerEvent[], settings: AlertSettings): AlertCommand[] {
  const commands: AlertCommand[] = [];
  for (const event of events) {
    const slot = slotForEvent(event);
    if (slot) {
      const soundId = soundForEvent(event, slot, settings);
      if (soundId && soundId !== SILENT_SOUND_ID && settings.volume > 0) {
        commands.push({ type: 'sound', soundId, volume: settings.volume, slot });
      }
      if (settings.hapticsEnabled) {
        commands.push({ type: 'haptic', style: HAPTIC_BY_SLOT[slot] });
      }
    }
    const text = speechForEvent(event, settings);
    if (text) commands.push({ type: 'speak', text, lang: settings.voiceLang });
  }
  return commands;
}
