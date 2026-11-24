import type { AlertCommand, SoundId } from '@/domain/alerts';

export type AudioOptions = {
  /** Abaixa a música de outros apps (true) ou toca por cima sem interferir (false). */
  duckMusic: boolean;
};

/** Executa comandos de alerta (som, vibração e voz). Implementação real: expo-audio/haptics/speech. */
export interface AlertPlayer {
  /** Registra arquivos de sons importados pelo usuário (id → uri). */
  registerSources(sources: Record<SoundId, string>): void;
  /** Configura a sessão de áudio e pré-carrega os sons para tocar sem latência. */
  prepare(soundIds: SoundId[], options?: AudioOptions): Promise<void>;
  execute(commands: AlertCommand[]): void;
  /**
   * Toca um som avulso (pré-escuta). Interrompe a pré-escuta anterior.
   * `onEnd` é chamado quando o som termina sozinho (não quando é parado).
   */
  preview(soundId: SoundId, volume?: number, onEnd?: () => void): void;
  /** Para a pré-escuta em andamento, se houver. */
  stopPreview(): void;
  /** Interrompe a fala e libera recursos de áudio. */
  release(): void;
}

/** Implementação que só registra comandos — testes e plataformas sem áudio. */
export function createSilentAlertPlayer() {
  const state = {
    executed: [] as AlertCommand[],
    previewed: [] as SoundId[],
    previewStops: 0,
    /** Simula o fim natural da pré-escuta atual (testes). */
    finishPreview: null as (() => void) | null,
    prepared: [] as SoundId[],
    options: null as AudioOptions | null,
    sources: {} as Record<SoundId, string>,
    released: 0,
  };
  const player: AlertPlayer & typeof state = Object.assign(state, {
    registerSources(sources: Record<SoundId, string>) {
      Object.assign(state.sources, sources);
    },
    async prepare(soundIds: SoundId[], options?: AudioOptions) {
      state.prepared.push(...soundIds);
      state.options = options ?? null;
    },
    execute(commands: AlertCommand[]) {
      state.executed.push(...commands);
    },
    preview(soundId: SoundId, _volume?: number, onEnd?: () => void) {
      state.previewed.push(soundId);
      state.finishPreview = onEnd
        ? () => {
            state.finishPreview = null;
            onEnd();
          }
        : null;
    },
    stopPreview() {
      state.previewStops++;
      state.finishPreview = null;
    },
    release() {
      state.released++;
    },
  });
  return player;
}
