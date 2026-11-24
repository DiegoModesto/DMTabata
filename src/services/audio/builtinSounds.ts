import type { BuiltinSoundId } from '@/domain/alerts';

export type BuiltinSound = { id: BuiltinSoundId; name: string };

/** Catálogo de sons embutidos (gerados por `scripts/generate-sounds.mjs`). */
export const BUILTIN_SOUNDS: BuiltinSound[] = [
  { id: 'go', name: 'Largada' },
  { id: 'rest', name: 'Acorde suave' },
  { id: 'beep', name: 'Bipe' },
  { id: 'beep-high', name: 'Bipe agudo' },
  { id: 'double-beep', name: 'Bipe duplo' },
  { id: 'whistle', name: 'Apito' },
  { id: 'bell', name: 'Sino' },
  { id: 'gong', name: 'Gongo' },
  { id: 'horn', name: 'Buzina' },
  { id: 'finish', name: 'Fanfarra' },
];

export const isBuiltinSoundId = (id: string): id is BuiltinSoundId =>
  BUILTIN_SOUNDS.some((s) => s.id === id);
