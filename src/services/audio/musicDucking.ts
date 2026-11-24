/** Fração do volume da música enquanto outro áudio toca. */
export const MUSIC_DUCK_LEVEL = 0.3;

/**
 * Decide quando a música de fundo fica abaixada:
 * - enquanto qualquer outro áudio estiver tocando (alertas, surpresas, voz);
 * - durante uma "retenção" explícita (contagem regressiva dos segundos finais).
 * `apply` recebe o fator (1 = volume cheio) só quando ele muda.
 */
export function createMusicDucking(apply: (factor: number) => void) {
  const active = new Set<unknown>();
  let held = false;
  let factor = 1;

  const update = () => {
    const next = held || active.size > 0 ? MUSIC_DUCK_LEVEL : 1;
    if (next === factor) return;
    factor = next;
    apply(next);
  };

  return {
    /** Um áudio começou a tocar. */
    started(key: unknown) {
      active.add(key);
      update();
    },
    /** Um áudio terminou ou foi interrompido. */
    ended(key: unknown) {
      active.delete(key);
      update();
    },
    /** Mantém a música abaixada (ex.: nos segundos finais da fase). */
    hold() {
      held = true;
      update();
    },
    release() {
      held = false;
      update();
    },
    /** Descarta áudios que já não estão tocando (rede de segurança). */
    prune(isPlaying: (key: unknown) => boolean) {
      for (const key of [...active]) if (!isPlaying(key)) active.delete(key);
      update();
    },
    reset() {
      active.clear();
      held = false;
      update();
    },
    factor: () => factor,
  };
}

export type MusicDucking = ReturnType<typeof createMusicDucking>;
