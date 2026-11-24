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

export type SoundCategory = 'training' | 'fight' | 'alerts' | 'user';

export const SOUND_CATEGORY_LABELS: Record<SoundCategory, string> = {
  training: 'Sinais de treino',
  fight: 'Ringue e luta',
  alerts: 'Alertas sonoros',
  user: 'Meus sons',
};

export const SOUND_CATEGORY_ORDER: SoundCategory[] = ['training', 'fight', 'alerts', 'user'];

export const BUILTIN_SOUNDS: { id: BuiltinSoundId; name: string; category: SoundCategory }[] = [
  { id: 'go', name: 'Largada', category: 'training' },
  { id: 'rest', name: 'Acorde suave', category: 'training' },
  { id: 'whistle', name: 'Apito', category: 'training' },
  { id: 'horn', name: 'Buzina', category: 'training' },
  { id: 'finish', name: 'Fanfarra', category: 'training' },
  { id: 'start-321', name: 'Contagem 3-2-1', category: 'training' },
  { id: 'ring-bell', name: 'Sino de ringue', category: 'fight' },
  { id: 'ring-bell-3', name: 'Sino de ringue (fim de round)', category: 'fight' },
  { id: 'clapper', name: 'Batida de aviso (10 s)', category: 'fight' },
  { id: 'gong', name: 'Gongo', category: 'fight' },
  { id: 'buzzer', name: 'Sirene de placar', category: 'fight' },
  { id: 'beep', name: 'Bipe', category: 'alerts' },
  { id: 'beep-high', name: 'Bipe agudo', category: 'alerts' },
  { id: 'double-beep', name: 'Bipe duplo', category: 'alerts' },
  { id: 'tick', name: 'Tique', category: 'alerts' },
  { id: 'bell', name: 'Sino', category: 'alerts' },
  { id: 'chime', name: 'Notificação', category: 'alerts' },
  { id: 'alarm', name: 'Alarme', category: 'alerts' },
  { id: 'siren', name: 'Sirene', category: 'alerts' },
];

/** Categoria de um som da biblioteca (importados e gravados ficam em "Meus sons"). */
export function soundCategory(sound: Pick<SoundEntry, 'id' | 'source'>): SoundCategory {
  if (sound.source === 'user') return 'user';
  return BUILTIN_SOUNDS.find((b) => b.id === sound.id)?.category ?? 'alerts';
}

/** Agrupa a biblioteca por categoria, na ordem de exibição, omitindo grupos vazios. */
export function groupSounds(
  library: SoundEntry[],
): { category: SoundCategory; label: string; sounds: SoundEntry[] }[] {
  return SOUND_CATEGORY_ORDER.map((category) => ({
    category,
    label: SOUND_CATEGORY_LABELS[category],
    sounds: library.filter((s) => soundCategory(s) === category),
  })).filter((g) => g.sounds.length > 0);
}

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
  { ok: true; name: string; extension: string } | { ok: false; reason: string };

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

// ---------- Gravação pelo microfone ----------

export const RECORDING_LIMITS = {
  /** Duração máxima de um som gravado. */
  maxMs: 3000,
  /** Abaixo disso é quase certamente um toque acidental. */
  minMs: 300,
  /** Folga para o atraso entre o fim pedido e o fim real do gravador. */
  toleranceMs: 250,
  maxBytes: IMPORT_LIMITS.maxBytes,
} as const;

export type RecordingCandidate = {
  durationMs: number;
  sizeBytes: number | null;
};

export type RecordingCheck = { ok: true } | { ok: false; reason: string };

/** Regras de negócio para aceitar uma gravação como som do app. */
export function checkRecording(candidate: RecordingCandidate): RecordingCheck {
  if (!Number.isFinite(candidate.durationMs) || candidate.durationMs < RECORDING_LIMITS.minMs) {
    return { ok: false, reason: 'Gravação curta demais. Segure por pelo menos meio segundo.' };
  }
  if (candidate.durationMs > RECORDING_LIMITS.maxMs + RECORDING_LIMITS.toleranceMs) {
    return { ok: false, reason: 'A gravação pode ter no máximo 3 segundos.' };
  }
  if (candidate.sizeBytes === 0) return { ok: false, reason: 'A gravação ficou vazia.' };
  if (candidate.sizeBytes !== null && candidate.sizeBytes > RECORDING_LIMITS.maxBytes) {
    return { ok: false, reason: 'Arquivo de gravação muito grande.' };
  }
  return { ok: true };
}

/** Próximo nome livre no formato "Gravação N". */
export function nextRecordingName(library: Pick<SoundEntry, 'name'>[]): string {
  const used = new Set(library.map((s) => s.name.trim().toLowerCase()));
  let n = 1;
  while (used.has(`gravação ${n}`)) n++;
  return `Gravação ${n}`;
}

/** Nome final de um som gravado: o digitado (limpo e cortado) ou o sugerido. */
export function recordingName(typed: string, suggested: string): string {
  const clean = typed.replace(/\s+/g, ' ').trim();
  return (clean || suggested).slice(0, IMPORT_LIMITS.maxNameLength);
}

/** Extensão do arquivo gravado a partir da uri (m4a é o padrão do gravador). */
export function recordingExtension(uri: string): string {
  const match = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(uri);
  const ext = match?.[1]?.toLowerCase() ?? '';
  return (IMPORT_LIMITS.extensions as readonly string[]).includes(ext) ? ext : 'm4a';
}

// ---------- Caminho dos arquivos ----------

const DOCUMENTS_MARKER = '/Documents/';

/**
 * O iOS pode mudar o caminho da pasta do app entre instalações/atualizações.
 * Reancora uma uri salva (`file:///…/Documents/sounds/x.mp3`) na pasta atual.
 * Uris sem a pasta Documents (ou não-arquivo) ficam como estão.
 */
export function rebaseDocumentUri(uri: string, documentDirUri: string): string {
  if (!uri.startsWith('file://')) return uri;
  const at = uri.indexOf(DOCUMENTS_MARKER);
  if (at < 0) return uri;
  const base = documentDirUri.endsWith('/') ? documentDirUri : `${documentDirUri}/`;
  return base + uri.slice(at + DOCUMENTS_MARKER.length);
}
