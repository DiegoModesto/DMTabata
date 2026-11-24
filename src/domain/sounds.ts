import { SILENT_SOUND_ID, type BuiltinSoundId } from './alerts';

export type SoundSource = 'builtin' | 'user';

export type SoundEntry = {
  id: string;
  name: string;
  source: SoundSource;
  /** `builtin:<id>` para sons embutidos; `file://...` para importados. */
  uri: string;
  createdAt: number;
};

export const BUILTIN_SOUNDS: { id: BuiltinSoundId; name: string }[] = [
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

export const SILENT_SOUND_NAME = 'Silencioso';

export const isBuiltinSoundId = (id: string): id is BuiltinSoundId =>
  BUILTIN_SOUNDS.some((s) => s.id === id);

export function soundName(id: string | null, library: SoundEntry[]): string {
  if (!id || id === SILENT_SOUND_ID) return SILENT_SOUND_NAME;
  return library.find((s) => s.id === id)?.name ?? 'Som removido';
}

// ---------- Importação de sons do usuário ----------

export const IMPORT_LIMITS = {
  maxBytes: 1024 * 1024,
  extensions: ['mp3', 'wav', 'm4a', 'aac', 'caf'],
  maxNameLength: 40,
} as const;

export type ImportCandidate = {
  fileName: string;
  sizeBytes: number | null;
};

export type ImportCheck =
  | { ok: true; name: string; extension: string }
  | { ok: false; reason: string };

/** Regras de negócio para aceitar um arquivo de som importado. */
export function checkImport(candidate: ImportCandidate): ImportCheck {
  const fileName = candidate.fileName.trim();
  const dot = fileName.lastIndexOf('.');
  const extension = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  if (!(IMPORT_LIMITS.extensions as readonly string[]).includes(extension)) {
    return {
      ok: false,
      reason: `Formato não suportado. Use ${IMPORT_LIMITS.extensions.join(', ')}.`,
    };
  }
  if (candidate.sizeBytes !== null && candidate.sizeBytes > IMPORT_LIMITS.maxBytes) {
    return { ok: false, reason: 'Arquivo muito grande (máximo 1 MB, ~5 segundos).' };
  }
  if (candidate.sizeBytes === 0) {
    return { ok: false, reason: 'Arquivo vazio.' };
  }
  const base = (dot >= 0 ? fileName.slice(0, dot) : fileName)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const name = (base || 'Meu som').slice(0, IMPORT_LIMITS.maxNameLength);
  return { ok: true, name, extension };
}
