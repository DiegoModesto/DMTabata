import { useState } from 'react';

import type { Recording, SoundRecorderState } from '@/features/sounds/use-sound-recorder';

/** Controle do gravador falso: define permissão e o resultado da próxima gravação. */
export const recorderControl = {
  permission: true,
  next: { uri: 'file:///cache/rec.m4a', durationMs: 2100, sizeBytes: 30_000 } as Recording,
  started: 0,
  played: 0,
};

export function resetRecorderControl() {
  recorderControl.permission = true;
  recorderControl.next = { uri: 'file:///cache/rec.m4a', durationMs: 2100, sizeBytes: 30_000 };
  recorderControl.started = 0;
  recorderControl.played = 0;
}

/** Substituto de `useSoundRecorder` para testes (sem microfone). */
export function useSoundRecorder(): SoundRecorderState {
  const [status, setStatus] = useState<SoundRecorderState['status']>('idle');
  const [recording, setRecording] = useState<Recording | null>(null);
  const [playing, setPlaying] = useState(false);
  return {
    status,
    recording,
    elapsedMs: recording?.durationMs ?? 0,
    start: async () => {
      recorderControl.started++;
      if (!recorderControl.permission) {
        setStatus('denied');
        return;
      }
      setRecording(null);
      setStatus('recording');
    },
    stop: async () => {
      setRecording({ ...recorderControl.next });
      setStatus('recorded');
    },
    playing,
    togglePlayback: () => {
      if (!playing) recorderControl.played++;
      setPlaying(!playing);
    },
    reset: () => {
      setPlaying(false);
      const previous = recording;
      setRecording(null);
      setStatus('idle');
      return previous;
    },
  };
}
