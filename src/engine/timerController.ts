import { alertsForEvents, type AlertCommand, type AlertSettings } from '@/domain/alerts';
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

  function update(now: number): ControllerUpdate {
    state = tick(state, now, timeline);
    const next = snapshot(state, now, timeline);
    const events = diffEvents(last, next, alertSettings, state.stoppedEarly);
    last = next;
    return { snapshot: next, events, commands: alertsForEvents(events, alertSettings) };
  }

  return {
    getState: () => state,
    setSettings(next: AlertSettings) {
      alertSettings = next;
    },
    dispatch(action: TimerAction, now: number): ControllerUpdate {
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
      return update(now);
    },
    update,
  };
}

export type TimerController = ReturnType<typeof createTimerController>;
