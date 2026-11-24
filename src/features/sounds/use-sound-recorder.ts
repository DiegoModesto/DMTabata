import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioPlayerStatus,
  useAudioRecorderState,
  type RecordingStatus,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useRef, useState } from 'react';

import { RECORDING_LIMITS } from '@/domain/sounds';

export type Recording = { uri: string; durationMs: number; sizeBytes: number | null };

export type SoundRecorderState = {
  status: 'idle' | 'recording' | 'recorded' | 'denied' | 'error';
  /** Tempo gravado até agora (ms), limitado ao máximo permitido. */
  elapsedMs: number;
  recording: Recording | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** A gravação está tocando (pré-escuta). */
  playing: boolean;
  /** Ouve a gravação do início, ou pausa se já estiver tocando. */
  togglePlayback: () => void;
  /** Volta ao estado inicial, devolvendo a gravação que havia (para descarte). */
  reset: () => Recording | null;
};

/** Volta a sessão de áudio ao modo de reprodução (alto-falante, sem microfone). */
async function restorePlaybackMode() {
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  } catch {
    // sem efeito: o player reconfigura a sessão na próxima reprodução
  }
}

function fileSize(uri: string): number | null {
  try {
    const file = new File(uri);
    return file.exists ? (file.size ?? null) : null;
  } catch {
    return null;
  }
}

/** Grava até `RECORDING_LIMITS.maxMs` pelo microfone; para sozinho no limite. */
export function useSoundRecorder(): SoundRecorderState {
  const [status, setStatus] = useState<SoundRecorderState['status']>('idle');
  const [recording, setRecording] = useState<Recording | null>(null);
  const startedAt = useRef(0);
  const finalized = useRef(true);

  const finalize = useCallback((uri: string | null) => {
    if (finalized.current) return;
    finalized.current = true;
    void restorePlaybackMode();
    if (!uri) {
      setStatus('error');
      return;
    }
    const durationMs = Math.min(Date.now() - startedAt.current, RECORDING_LIMITS.maxMs);
    setRecording({ uri, durationMs, sizeBytes: fileSize(uri) });
    setStatus('recorded');
  }, []);

  const onStatus = useCallback(
    (s: RecordingStatus) => {
      if (s.hasError) {
        finalized.current = true;
        void restorePlaybackMode();
        setStatus('error');
      } else if (s.isFinished) finalize(s.url);
    },
    [finalize],
  );

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, onStatus);
  const recorderState = useAudioRecorderState(recorder, 100);
  const player = useAudioPlayer(recording?.uri ?? null);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setStatus('denied');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      setRecording(null);
      finalized.current = false;
      startedAt.current = Date.now();
      recorder.record({ forDuration: RECORDING_LIMITS.maxMs / 1000 });
      setStatus('recording');
    } catch {
      finalized.current = true;
      void restorePlaybackMode();
      setStatus('error');
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    if (finalized.current) return;
    try {
      await recorder.stop();
    } finally {
      finalize(recorder.uri);
    }
  }, [recorder, finalize]);

  const playerStatus = useAudioPlayerStatus(player);
  const playing = !!recording && playerStatus.playing;

  const togglePlayback = useCallback(() => {
    if (playing) {
      player.pause();
      return;
    }
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
  }, [player, playing]);

  const reset = useCallback(() => {
    if (playing) player.pause();
    const previous = recording;
    setRecording(null);
    setStatus('idle');
    return previous;
  }, [recording, playing, player]);

  const elapsedMs =
    status === 'recording'
      ? Math.min(recorderState.durationMillis, RECORDING_LIMITS.maxMs)
      : (recording?.durationMs ?? 0);

  return { status, elapsedMs, recording, start, stop, playing, togglePlayback, reset };
}
