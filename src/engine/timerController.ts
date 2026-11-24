import { alertsForEvents, type AlertCommand, type AlertSettings } from '@/domain/alerts';
import { createSessionRecorder, type SessionLog } from '@/domain/sessionRecorder';
import type { Timeline } from '@/domain/timeline';

import {
  back,
  diffEvents,
  initialTimerState,
  pause,
  resume,
  skip,
  snapshot,
  start,
  stop,
  tick,
  type TimerEvent,
  type TimerSnapshot,
  type TimerState,
} from './timerEngine';

export type TimerAction = 'start' | 'pause' | 'resume' | 'skip' | 'back' | 'stop';

export type ControllerUpdate = {
  snapshot: TimerSnapshot;
  events: TimerEvent[];
  commands: AlertCommand[];
};

/**
 * Orquestra motor + eventos + alertas, sem React. O hook `usePlayer` apenas chama
 * `update(now)` periodicamente e repassa os comandos para o AlertPlayer.
 */
export function createTimerController(timeline: Timeline, settings: AlertSettings) {
  let state: TimerState = initialTimerState;
  let last: TimerSnapshot | null = null;
  let alertSettings = settings;
  const recorder = createSessionRecorder(timeline);

  function update(now: number): ControllerUpdate {
    state = tick(state, now, timeline);
    const next = snapshot(state, now, timeline);
    recorder.observe(next, now);
    const events = diffEvents(last, next, alertSettings, state.stoppedEarly);
    last = next;
    return { snapshot: next, events, commands: alertsForEvents(events, alertSettings) };
  }

  return {
    getState: () => state,
    /** Snapshot do instante sem registrar eventos (consulta). */
    peek: (now: number) => snapshot(state, now, timeline),
    setSettings(next: AlertSettings) {
      alertSettings = next;
    },
    /** Registro das fases realizadas até agora (para estatísticas). */
    getLog: (): SessionLog => recorder.log(),
    dispatch(action: TimerAction, now: number): ControllerUpdate {
      // Contabiliza o tempo até este instante antes de a ação mudar o estado.
      const before = snapshot(tick(state, now, timeline), now, timeline);
      recorder.observe(before, now);
      switch (action) {
        case 'start':
          state = start(state, now, timeline);
          break;
        case 'pause':
          state = pause(state, now);
          break;
        case 'resume':
          state = resume(state, now);
          break;
        case 'skip':
          if (before.phaseIndex >= 0) recorder.markSkipped(before.phaseIndex);
          state = skip(state, now, timeline);
          break;
        case 'back': {
          const before = snapshot(state, now, timeline).phaseIndex;
          state = back(state, now, timeline);
          // Voltar para o início da mesma fase deve tocar o som de início de novo.
          if (snapshot(state, now, timeline).phaseIndex === before) last = null;
          break;
        }
        case 'stop':
          state = stop(state, now, timeline);
          break;
      }
      recorder.rebase(snapshot(state, now, timeline), now);
      return update(now);
    },
    update,
  };
}

export type TimerController = ReturnType<typeof createTimerController>;
