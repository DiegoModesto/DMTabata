import type { BuiltinSoundId } from '@/domain/alerts';

/** Mapeia id → asset empacotado (require estático exigido pelo Metro). */
export const BUILTIN_SOUND_SOURCES: Record<BuiltinSoundId, number> = {
  go: require('@/assets/sounds/go.wav'),
  rest: require('@/assets/sounds/rest.wav'),
  beep: require('@/assets/sounds/beep.wav'),
  'beep-high': require('@/assets/sounds/beep-high.wav'),
  'double-beep': require('@/assets/sounds/double-beep.wav'),
  whistle: require('@/assets/sounds/whistle.wav'),
  bell: require('@/assets/sounds/bell.wav'),
  gong: require('@/assets/sounds/gong.wav'),
  horn: require('@/assets/sounds/horn.wav'),
  finish: require('@/assets/sounds/finish.wav'),
  'ring-bell': require('@/assets/sounds/ring-bell.wav'),
  'ring-bell-3': require('@/assets/sounds/ring-bell-3.wav'),
  clapper: require('@/assets/sounds/clapper.wav'),
  tick: require('@/assets/sounds/tick.wav'),
  'start-321': require('@/assets/sounds/start-321.wav'),
  alarm: require('@/assets/sounds/alarm.wav'),
  siren: require('@/assets/sounds/siren.wav'),
  buzzer: require('@/assets/sounds/buzzer.wav'),
  chime: require('@/assets/sounds/chime.wav'),
};
