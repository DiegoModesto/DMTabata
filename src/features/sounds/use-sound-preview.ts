import { useCallback, useEffect, useState } from 'react';

import { useServices } from '@/providers/services-provider';

/**
 * Pré-escuta com alternância play/pause: tocar um som mostra "pausar" nele;
 * tocar de novo (ou outro som) para o anterior. Volta sozinho ao fim do áudio.
 */
export function useSoundPreview() {
  const { alertPlayer } = useServices();
  /** Chave do botão que está tocando (o mesmo som pode aparecer em vários lugares). */
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const toggle = useCallback(
    (key: string, soundId: string, volume?: number) => {
      if (playingKey === key) {
        alertPlayer.stopPreview();
        setPlayingKey(null);
        return;
      }
      setPlayingKey(key);
      alertPlayer.preview(soundId, volume, () =>
        setPlayingKey((current) => (current === key ? null : current)),
      );
    },
    [alertPlayer, playingKey],
  );

  const stop = useCallback(() => {
    alertPlayer.stopPreview();
    setPlayingKey(null);
  }, [alertPlayer]);

  const isPlaying = useCallback((key: string) => playingKey === key, [playingKey]);

  // Sair da tela para a pré-escuta.
  useEffect(() => () => alertPlayer.stopPreview(), [alertPlayer]);

  return { playingKey, isPlaying, toggle, stop };
}

/** Rótulo e ícone do botão de pré-escuta. */
export const previewButton = (playing: boolean, name: string) =>
  ({
    icon: playing ? 'pause' : 'play',
    label: playing ? `Parar ${name}` : `Ouvir ${name}`,
  }) as const;
