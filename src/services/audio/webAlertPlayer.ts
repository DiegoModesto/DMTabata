import type { AlertCommand, HapticStyle, SoundId } from '@/domain/alerts';

import type { AlertPlayer } from './alertPlayer';
import { createMusicDucking } from './musicDucking';

/**
 * Player de alertas para a web (PWA), sobre a Web Audio API.
 *
 * Por que não `<audio>`: no iPhone o Safari ignora o volume de elementos de mídia
 * (a música não abaixaria) e bloqueia sons disparados por temporizador.
 * Com um AudioContext liberado no primeiro toque, qualquer som toca depois,
 * cada um com o próprio ganho, e a música abaixa de verdade.
 */

/** Subconjunto da Web Audio API usado aqui (permite um contexto falso nos testes). */
export type AudioParamLike = {
  value: number;
  setTargetAtTime?(v: number, t: number, c: number): void;
};
export type GainNodeLike = {
  gain: AudioParamLike;
  connect(node: unknown): void;
  disconnect(): void;
};
export type SourceNodeLike = {
  buffer: unknown;
  loop: boolean;
  onended: (() => void) | null;
  connect(node: unknown): void;
  start(when?: number, offset?: number): void;
  stop(): void;
  disconnect(): void;
};
export type AudioContextLike = {
  state: string;
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  createGain(): GainNodeLike;
  createBufferSource(): SourceNodeLike;
  decodeAudioData(data: ArrayBuffer): Promise<{ duration: number }>;
};

export type WebAlertPlayerDeps = {
  createContext: () => AudioContextLike;
  /** Url tocável de um som (embutido ou do usuário). */
  sourceUri: (soundId: SoundId, userSources: Record<SoundId, string>) => string | null;
  fetchBytes: (uri: string) => Promise<ArrayBuffer>;
  speak: (text: string, lang: string, done: () => void) => void;
  stopSpeech: () => void;
  vibrate?: (pattern: number | number[]) => void;
};

const VIBRATION: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [20, 60, 20],
  warning: [40, 80, 40],
};

/** Tempo máximo que uma fala mantém a música abaixada. */
export const SPEECH_DUCK_LIMIT_MS = 8000;

type Voice = { source: SourceNodeLike; gain: GainNodeLike; stop(): void };

export function createWebAlertPlayer(deps: WebAlertPlayerDeps): AlertPlayer {
  let context: AudioContextLike | null = null;
  const ctx = () => (context ??= deps.createContext());
  const userSources: Record<SoundId, string> = {};
  const buffers = new Map<string, Promise<{ duration: number }>>();

  function load(soundId: SoundId) {
    const uri = deps.sourceUri(soundId, userSources);
    if (!uri) return null;
    let pending = buffers.get(uri);
    if (!pending) {
      pending = deps.fetchBytes(uri).then((bytes) => ctx().decodeAudioData(bytes));
      pending.catch(() => buffers.delete(uri)); // tenta de novo na próxima vez
      buffers.set(uri, pending);
    }
    return pending;
  }

  /**
   * Começa a tocar assim que o buffer estiver pronto.
   * `onEnd`: só quando termina sozinho. `onDone`: sempre que deixa de tocar (fim ou parada).
   */
  function start(
    soundId: SoundId,
    volume: number,
    options: { loop?: boolean; offset?: number; onEnd?: () => void; onDone?: () => void } = {},
  ): Voice | null {
    const buffer = load(soundId);
    if (!buffer) return null;
    const audio = ctx();
    const gain = audio.createGain();
    gain.gain.value = volume;
    gain.connect(audio.destination);
    const source = audio.createBufferSource();
    source.loop = !!options.loop;
    source.connect(gain);

    let started = false;
    let finished = false;
    const finish = (natural: boolean) => {
      if (finished) return;
      finished = true;
      source.onended = null;
      source.disconnect();
      gain.disconnect();
      options.onDone?.();
      if (natural) options.onEnd?.();
    };
    source.onended = () => finish(true);

    const voice: Voice = {
      source,
      gain,
      stop() {
        if (started) {
          try {
            source.stop();
          } catch {
            // já parado
          }
        }
        finish(false);
      },
    };
    buffer
      .then((decoded) => {
        if (finished) return;
        source.buffer = decoded;
        // 'suspended' ou 'interrupted' (Safari do iPhone após ligação, fala ou tela bloqueada).
        if (audio.state !== 'running') void audio.resume().catch(() => {});
        source.start(0, options.offset ?? 0);
        started = true;
      })
      .catch(() => finish(true));
    return voice;
  }

  const stop = (voice: Voice | null) => voice?.stop();

  // ---------- Música de fundo ----------
  let music: {
    soundId: SoundId;
    volume: number;
    voice: Voice | null;
    startedAt: number;
    offset: number;
  } | null = null;

  const setMusicGain = (value: number) => {
    const gain = music?.voice?.gain.gain;
    if (!gain) return;
    if (gain.setTargetAtTime) gain.setTargetAtTime(value, ctx().currentTime, 0.08);
    else gain.value = value;
  };
  const ducking = createMusicDucking((factor) => {
    if (music) setMusicGain(music.volume * factor);
  });

  function playMusic(offset: number) {
    if (!music) return;
    music.voice = start(music.soundId, music.volume * ducking.factor(), { loop: true, offset });
    music.startedAt = ctx().currentTime - offset;
  }

  function stopMusic() {
    if (!music) return;
    stop(music.voice);
    music = null;
    ducking.reset();
  }

  // ---------- Alertas ----------
  /** Toca um alerta e abaixa a música enquanto ele soa. */
  function alert(soundId: SoundId, volume: number, onEnd?: () => void): Voice | null {
    const key = {};
    if (music) ducking.started(key);
    const voice = start(soundId, volume, { onDone: () => ducking.ended(key), onEnd });
    if (!voice) ducking.ended(key);
    return voice;
  }

  let surprise: Voice | null = null;
  let preview: { voice: Voice | null } | null = null;

  function stopPreview() {
    if (!preview) return;
    const current = preview;
    preview = null;
    stop(current.voice);
  }

  return {
    registerSources(sources) {
      for (const [id, uri] of Object.entries(sources)) {
        const previous = userSources[id];
        if (previous && previous !== uri) buffers.delete(previous);
        userSources[id] = uri;
      }
    },
    async prepare(soundIds) {
      const audio = ctx();
      if (audio.state !== 'running') await audio.resume().catch(() => {});
      await Promise.all(soundIds.map((id) => load(id)?.catch(() => null)));
    },
    execute(commands: AlertCommand[]) {
      for (const command of commands) {
        if (command.type === 'sound') {
          if (command.channel === 'surprise') {
            stop(surprise);
            surprise = alert(command.soundId, command.volume);
          } else alert(command.soundId, command.volume);
        } else if (command.type === 'stopChannel') {
          stop(surprise);
          surprise = null;
        } else if (command.type === 'music') {
          if (command.action === 'start') {
            stopMusic();
            music = {
              soundId: command.soundId,
              volume: command.volume,
              voice: null,
              startedAt: 0,
              offset: 0,
            };
            playMusic(0);
          } else if (command.action === 'pause') {
            if (music?.voice) {
              music.offset = Math.max(0, ctx().currentTime - music.startedAt);
              stop(music.voice);
              music.voice = null;
            }
          } else if (command.action === 'resume') {
            if (music && !music.voice) playMusic(music.offset);
          } else if (command.action === 'duck') ducking.hold();
          else if (command.action === 'unduck') ducking.release();
          else stopMusic();
        } else if (command.type === 'haptic') {
          try {
            deps.vibrate?.(VIBRATION[command.style]);
          } catch {
            // sem vibração (iPhone/desktop)
          }
        } else {
          const key = {};
          if (music) ducking.started(key);
          // O Safari às vezes não avisa o fim da fala: sem o limite, a música ficaria baixa.
          let ended = false;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const end = () => {
            if (ended) return;
            ended = true;
            clearTimeout(timer);
            ducking.ended(key);
          };
          timer = setTimeout(end, SPEECH_DUCK_LIMIT_MS);
          deps.speak(command.text, command.lang, end);
        }
      }
    },
    preview(soundId, volume = 1, onEnd) {
      stopPreview();
      const current: { voice: Voice | null } = { voice: null };
      preview = current;
      current.voice = start(soundId, volume, {
        onEnd: () => {
          if (preview !== current) return;
          preview = null;
          onEnd?.();
        },
      });
      if (!current.voice) {
        preview = null;
        onEnd?.();
      }
    },
    stopPreview,
    release() {
      stopPreview();
      stopMusic();
      stop(surprise);
      surprise = null;
      deps.stopSpeech();
    },
  };
}
