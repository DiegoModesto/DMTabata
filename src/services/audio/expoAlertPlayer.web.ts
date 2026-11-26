import { Asset } from 'expo-asset';
import * as Speech from 'expo-speech';

import { isBuiltinSoundId } from '@/domain/sounds';

import type { AlertPlayer } from './alertPlayer';
import { BUILTIN_SOUND_SOURCES } from './builtinSoundSources';
import { createWebAlertPlayer, type AudioContextLike } from './webAlertPlayer';

type WindowWithAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
type NavigatorWithSession = Navigator & { audioSession?: { type: string } };

/**
 * Cria o AudioContext e o libera no primeiro toque/tecla: navegadores (principalmente o
 * Safari do iPhone) só deixam tocar som depois de um gesto do usuário.
 */
function createUnlockedContext(): AudioContextLike {
  const Ctor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext!;
  const context = new Ctor();
  // Safari 17+: toca mesmo com a chave de silencioso ligada, como o app nativo.
  const session = (navigator as NavigatorWithSession).audioSession;
  if (session) session.type = 'playback';
  const unlock = () => {
    if (context.state !== 'running') void context.resume().catch(() => {});
  };
  for (const event of ['pointerdown', 'touchend', 'keydown']) {
    document.addEventListener(event, unlock, { capture: true, passive: true });
  }
  return context as unknown as AudioContextLike;
}

export function createExpoAlertPlayer(): AlertPlayer {
  // Criado já na abertura do app, para que qualquer toque (login, lista, "Começar")
  // libere o áudio antes de o treino precisar tocar algo.
  const context = createUnlockedContext();
  return createWebAlertPlayer({
    createContext: () => context,
    sourceUri: (soundId, userSources) =>
      isBuiltinSoundId(soundId)
        ? Asset.fromModule(BUILTIN_SOUND_SOURCES[soundId]).uri
        : (userSources[soundId] ?? null),
    fetchBytes: async (uri) => {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`Som indisponível: ${uri}`);
      return response.arrayBuffer();
    },
    speak: (text, lang, done) =>
      Speech.speak(text, { language: lang, onDone: done, onStopped: done, onError: done }),
    stopSpeech: () => void Speech.stop(),
    vibrate: typeof navigator.vibrate === 'function' ? (p) => void navigator.vibrate(p) : undefined,
  });
}
