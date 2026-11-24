import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import type { AlertCommand, HapticStyle, SoundId } from '@/domain/alerts';

import type { AlertPlayer } from './alertPlayer';
import { isBuiltinSoundId } from './builtinSounds';
import { BUILTIN_SOUND_SOURCES } from './builtinSoundSources';

/** Resolve a origem de um som: embutido (asset) ou arquivo do usuário (uri). */
export type SoundSourceResolver = (soundId: SoundId) => number | string | null;

export const resolveBuiltinSource: SoundSourceResolver = (id) =>
  isBuiltinSoundId(id) ? BUILTIN_SOUND_SOURCES[id] : null;

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

export function createExpoAlertPlayer(
  resolveSource: SoundSourceResolver = resolveBuiltinSource,
): AlertPlayer {
  const players = new Map<SoundId, AudioPlayer>();
  let audioModeSet = false;

  async function ensureAudioMode() {
    if (audioModeSet) return;
    audioModeSet = true;
    try {
      // Toca no modo silencioso e abaixa (não pausa) a música de outros apps.
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
    } catch {
      audioModeSet = false;
    }
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

  function play(soundId: SoundId, volume: number) {
    const player = getPlayer(soundId);
    if (!player) return;
    player.volume = volume;
    player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
  }

  return {
    async prepare(soundIds) {
      await ensureAudioMode();
      soundIds.forEach((id) => getPlayer(id));
    },
    execute(commands: AlertCommand[]) {
      void ensureAudioMode();
      for (const command of commands) {
        if (command.type === 'sound') play(command.soundId, command.volume);
        else playHaptic(command.style);
      }
    },
    preview(soundId, volume = 1) {
      void ensureAudioMode().then(() => play(soundId, volume));
    },
    release() {
      players.forEach((p) => p.remove());
      players.clear();
    },
  };
}
