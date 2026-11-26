import { Asset } from 'expo-asset';
import * as Speech from 'expo-speech';

import { isBuiltinSoundId } from '@/domain/sounds';

import type { AlertPlayer } from './alertPlayer';
import { BUILTIN_SOUND_SOURCES } from './builtinSoundSources';
import { createWebAlertPlayer, type AudioContextLike } from './webAlertPlayer';

type WindowWithAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
type NavigatorWithSession = Navigator & { audioSession?: { type: string } };

/**
 * Cria o AudioContext e o mantém liberado. Navegadores (principalmente o Safari do
 * iPhone) só deixam tocar som depois de um gesto do usuário, e o iPhone volta a
 * travar o áudio ('interrupted') após ligação, fala, troca de app ou tela bloqueada.
 * Por isso todo toque tenta retomar o contexto — não só o primeiro.
 */
function createUnlockedContext(): AudioContextLike {
  const Ctor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext!;
  const context = new Ctor();
  // Safari 17+: toca mesmo com a chave de silencioso ligada, como o app nativo.
  const session = (navigator as NavigatorWithSession).audioSession;
  if (session) session.type = 'playback';

  let primed = false;
  const unlock = () => {
    if (context.state !== 'running') void context.resume().catch(() => {});
    if (primed) return;
    primed = true;
    try {
      // O Safari antigo só libera de verdade ao tocar algo dentro do gesto.
      const silent = context.createBufferSource();
      silent.buffer = context.createBuffer(1, 1, 22050);
      silent.connect(context.destination);
      silent.start(0);
      // A fala também precisa ser liberada num gesto no iPhone.
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      primed = false;
    }
  };
  for (const event of ['pointerdown', 'touchend', 'click', 'keydown']) {
    document.addEventListener(event, unlock, { capture: true, passive: true });
  }
  // Voltando ao app (ou fim da interrupção), tenta retomar sem esperar outro toque.
  const tryResume = () => {
    if (document.visibilityState === 'visible' && context.state !== 'running') {
      void context.resume().catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', tryResume);
  window.addEventListener('pageshow', tryResume);
  context.addEventListener('statechange', tryResume);
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
