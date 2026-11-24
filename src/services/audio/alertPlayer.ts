import type { AlertCommand, SoundId } from '@/domain/alerts';

/** Executa comandos de alerta (som + vibração). Implementação real usa expo-audio/expo-haptics. */
export interface AlertPlayer {
  /** Pré-carrega os sons para tocar sem latência. */
  prepare(soundIds: SoundId[]): Promise<void>;
  execute(commands: AlertCommand[]): void;
  /** Toca um som avulso (pré-escuta na tela de sons). */
  preview(soundId: SoundId, volume?: number): void;
  /** Libera recursos de áudio. */
  release(): void;
}

/** Implementação silenciosa — testes e plataformas sem áudio. */
export function createSilentAlertPlayer(): AlertPlayer & { executed: AlertCommand[] } {
  const executed: AlertCommand[] = [];
  return {
    executed,
    async prepare() {},
    execute(commands) {
      executed.push(...commands);
    },
    preview() {},
    release() {},
  };
}
