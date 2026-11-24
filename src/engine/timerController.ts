import { alertsForEvents, type AlertCommand, type AlertSettings } from '@/domain/alerts';
import { createSessionRecorder, type SessionLog } from '@/domain/sessionRecorder';
import { dueSurprises, planSurprises, type Surprise } from '@/domain/surprises';
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
export function createTimerController(
  timeline: Timeline,
  settings: AlertSettings,
  random: () => number = Math.random,
) {
  let state: TimerState = initialTimerState;
  let last: TimerSnapshot | null = null;
  let alertSettings = settings;
  const recorder = createSessionRecorder(timeline);
  // Sorteio feito uma vez por treino (refeito só se a lista/chance mudar).
  let surprises: Surprise[] = planSurprises(timeline, settings, random);

  const stopSurprise: AlertCommand = { type: 'stopChannel', channel: 'surprise' };
  const stopMusic: AlertCommand = { type: 'music', action: 'stop' };

  // A música fica abaixada dos segundos finais (contagem) até a próxima fase começar.
  let musicHeld = false;
  function musicDuckCommands(events: TimerEvent[]): AlertCommand[] {
    if (!alertSettings.backgroundMusicId) return [];
    const out: AlertCommand[] = [];
    if (musicHeld && events.some((e) => e.type === 'phaseStarted' || e.type === 'finished')) {
      musicHeld = false;
      out.push({ type: 'music', action: 'unduck' });
    }
    if (!musicHeld && events.some((e) => e.type === 'countdown')) {
      musicHeld = true;
      out.push({ type: 'music', action: 'duck' });
    }
    return out;
  }

  /** Comando de música de fundo para uma ação do usuário, se houver música. */
  function musicCommand(action: TimerAction): AlertCommand | null {
    const id = alertSettings.backgroundMusicId;
    if (!id) return null;
    switch (action) {
      case 'start':
        if (alertSettings.volume <= 0 || alertSettings.musicVolume <= 0) return null;
        return {
          type: 'music',
          action: 'start',
          soundId: id,
          volume: alertSettings.volume * alertSettings.musicVolume,
        };
      case 'pause':
      case 'resume':
        return { type: 'music', action };
      case 'stop':
        return stopMusic;
      default:
        return null;
    }
  }

  function surpriseCommands(prev: TimerSnapshot | null, next: TimerSnapshot): AlertCommand[] {
    if (alertSettings.volume <= 0) return [];
    return dueSurprises(surprises, prev, next).map((s) => ({
      type: 'sound',
      soundId: s.soundId,
      volume: alertSettings.volume,
      slot: 'surprise',
      channel: 'surprise',
    }));
  }

  function update(now: number): ControllerUpdate {
    state = tick(state, now, timeline);
    const next = snapshot(state, now, timeline);
    recorder.observe(next, now);
    const events = diffEvents(last, next, alertSettings, state.stoppedEarly);
    const commands = [
      ...musicDuckCommands(events),
      ...surpriseCommands(last, next),
      ...alertsForEvents(events, alertSettings),
    ];
    // Ao terminar, a trilha surpresa e a música param antes do som de fim.
    if (events.some((e) => e.type === 'finished')) {
      commands.unshift(stopSurprise);
      if (alertSettings.backgroundMusicId) commands.unshift(stopMusic);
    }
    last = next;
    return { snapshot: next, events, commands };
  }

  return {
    getState: () => state,
    /** Snapshot do instante sem registrar eventos (consulta). */
    peek: (now: number) => snapshot(state, now, timeline),
    setSettings(next: AlertSettings) {
      const changed =
        next.surpriseChance !== alertSettings.surpriseChance ||
        next.surpriseSounds.join() !== alertSettings.surpriseSounds.join();
      alertSettings = next;
      if (changed) surprises = planSurprises(timeline, next, random);
    },
    /** Surpresas sorteadas para este treino (consulta/testes). */
    getSurprises: () => surprises,
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
      const result = update(now);
      // Pausar ou parar silencia a trilha surpresa que estiver tocando.
      if ((action === 'pause' || action === 'stop') && !result.commands.includes(stopSurprise)) {
        result.commands.unshift(stopSurprise);
      }
      const music = musicCommand(action);
      if (music && !result.commands.includes(stopMusic)) {
        // A música começa antes do som da preparação; nas demais ações vem primeiro também.
        result.commands.unshift(music);
      }
      return result;
    },
    update,
  };
}

export type TimerController = ReturnType<typeof createTimerController>;
