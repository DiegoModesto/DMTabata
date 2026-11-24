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
};
