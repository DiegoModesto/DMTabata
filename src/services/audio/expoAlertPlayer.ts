import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import type { AlertCommand, HapticStyle, SoundId } from '@/domain/alerts';
import { isBuiltinSoundId } from '@/domain/sounds';

import type { AlertPlayer, AudioOptions } from './alertPlayer';
import { BUILTIN_SOUND_SOURCES } from './builtinSoundSources';

function playHaptic(style: HapticStyle) {
  const run = () => {
    switch (style) {
      case 'light':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  run()?.catch(() => {});
}

export function createExpoAlertPlayer(): AlertPlayer {
  const players = new Map<SoundId, AudioPlayer>();
  const userSources: Record<SoundId, string> = {};
  let currentMode: AudioOptions | null = null;
  /** Pré-escuta em andamento (tela de sons). */
  let currentPreview: { player: AudioPlayer; sub: { remove(): void } } | null = null;

  function stopPreview() {
    if (!currentPreview) return;
    const { player, sub } = currentPreview;
    currentPreview = null;
    sub.remove();
    try {
      player.pause();
      void player.seekTo(0).catch(() => {});
    } catch {
      // player já liberado
    }
  }

  /** Som do canal "surpresa" tocando agora (um novo interrompe o anterior). */
  let currentSurprise: AudioPlayer | null = null;

  function stopSurprise() {
    setMusicDucked(false);
    if (!currentSurprise) return;
    const player = currentSurprise;
    currentSurprise = null;
    try {
      player.pause();
      void player.seekTo(0).catch(() => {});
    } catch {
      // player já liberado
    }
  }

  async function applyAudioMode(options: AudioOptions = { duckMusic: true }) {
    if (currentMode?.duckMusic === options.duckMusic) return;
    currentMode = options;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: options.duckMusic ? 'duckOthers' : 'mixWithOthers',
      });
    } catch {
      currentMode = null;
    }
  }

  // ---------- Música de fundo (loop, abaixo dos alertas) ----------
  /** Quanto a música abaixa enquanto um som surpresa toca. */
  const MUSIC_DUCK = 0.4;
  let music: { player: AudioPlayer; volume: number } | null = null;

  function setMusicDucked(ducked: boolean) {
    if (!music) return;
    music.player.volume = ducked ? music.volume * MUSIC_DUCK : music.volume;
  }

  function startMusic(soundId: SoundId, volume: number) {
    stopMusic();
    const source = resolveSource(soundId);
    if (source === null) return;
    // Player próprio: não compartilha com a pré-escuta nem com os alertas.
    const player = createAudioPlayer(source);
    player.loop = true;
    player.volume = volume;
    player.play();
    music = { player, volume };
  }

  function stopMusic() {
    if (!music) return;
    const { player } = music;
    music = null;
    try {
      player.pause();
      player.remove();
    } catch {
      // já liberado
    }
  }

  function resolveSource(soundId: SoundId): number | string | null {
    if (isBuiltinSoundId(soundId)) return BUILTIN_SOUND_SOURCES[soundId];
    return userSources[soundId] ?? null;
  }

  function getPlayer(soundId: SoundId): AudioPlayer | null {
    const existing = players.get(soundId);
    if (existing) return existing;
    const source = resolveSource(soundId);
    if (source === null) return null;
    const player = createAudioPlayer(source);
    players.set(soundId, player);
    return player;
  }

  function play(soundId: SoundId, volume: number): AudioPlayer | null {
    const player = getPlayer(soundId);
    if (!player) return null;
    player.volume = volume;
    player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
    return player;
  }

  return {
    registerSources(sources) {
      for (const [id, uri] of Object.entries(sources)) {
        if (userSources[id] !== uri) {
          players.get(id)?.remove();
          players.delete(id);
        }
        userSources[id] = uri;
      }
    },
    async prepare(soundIds, options) {
      await applyAudioMode(options);
      soundIds.forEach((id) => getPlayer(id));
    },
    execute(commands: AlertCommand[]) {
      for (const command of commands) {
        if (command.type === 'sound') {
          if (command.channel === 'surprise') {
            stopSurprise();
            const player = play(command.soundId, command.volume);
            currentSurprise = player;
            if (player) {
              // A música fica por baixo enquanto a surpresa toca.
              setMusicDucked(true);
              const sub = player.addListener('playbackStatusUpdate', (status) => {
                if (!status.didJustFinish) return;
                sub.remove();
                if (currentSurprise === player) {
                  currentSurprise = null;
                  setMusicDucked(false);
                }
              });
            }
          } else play(command.soundId, command.volume);
        } else if (command.type === 'stopChannel') stopSurprise();
        else if (command.type === 'music') {
          if (command.action === 'start') startMusic(command.soundId, command.volume);
          else if (command.action === 'pause') music?.player.pause();
          else if (command.action === 'resume') music?.player.play();
          else stopMusic();
        } else if (command.type === 'haptic') playHaptic(command.style);
        else
          Speech.speak(command.text, { language: command.lang, useApplicationAudioSession: true });
      }
    },
    preview(soundId, volume = 1, onEnd) {
      stopPreview();
      void applyAudioMode(currentMode ?? undefined).then(() => {
        const player = play(soundId, volume);
        if (!player) {
          onEnd?.();
          return;
        }
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (!status.didJustFinish || currentPreview?.player !== player) return;
          currentPreview.sub.remove();
          currentPreview = null;
          onEnd?.();
        });
        currentPreview = { player, sub };
      });
    },
    stopPreview,
    release() {
      stopPreview();
      stopMusic();
      currentSurprise = null;
      void Speech.stop();
      players.forEach((p) => p.remove());
      players.clear();
    },
  };
}
