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
  /** Som do canal "surpresa" tocando agora (um novo interrompe o anterior). */
  let currentSurprise: AudioPlayer | null = null;

  function stopSurprise() {
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
            currentSurprise = play(command.soundId, command.volume);
          } else play(command.soundId, command.volume);
        } else if (command.type === 'stopChannel') stopSurprise();
        else if (command.type === 'haptic') playHaptic(command.style);
        else
          Speech.speak(command.text, { language: command.lang, useApplicationAudioSession: true });
      }
    },
    preview(soundId, volume = 1) {
      void applyAudioMode(currentMode ?? undefined).then(() => play(soundId, volume));
    },
    release() {
      currentSurprise = null;
      void Speech.stop();
      players.forEach((p) => p.remove());
      players.clear();
    },
  };
}
