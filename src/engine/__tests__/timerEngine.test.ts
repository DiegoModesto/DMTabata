import { compileTimeline } from '@/domain/timeline';
import { createTabataWorkout } from '@/domain/workout';
import { planExampleWorkout } from '@/test/factories';

import {
  back,
  BACK_THRESHOLD_MS,
  diffEvents,
  elapsedMs,
  initialTimerState,
  pause,
  resume,
  skip,
  snapshot,
  start,
  stop,
  tick,
  type TimerEvent,
} from '../timerEngine';

const timeline = compileTimeline(planExampleWorkout()); // 10s preparo + 220s
const T0 = 1_000_000;
const options = { countdownFrom: 3, halfwayAlert: false };

describe('timerEngine — estados', () => {
  it('idle → running com start', () => {
    const s = start(initialTimerState, T0, timeline);
    expect(s.status).toBe('running');
    expect(elapsedMs(s, T0 + 1500, timeline)).toBe(1500);
  });

  it('start em treino vazio termina imediatamente', () => {
    const s = start(initialTimerState, T0, { phases: [], totalMs: 0 });
    expect(s.status).toBe('finished');
  });

  it('pausa congela o tempo e o retomar desconta a pausa', () => {
    let s = start(initialTimerState, T0, timeline);
    s = pause(s, T0 + 5_000);
    expect(elapsedMs(s, T0 + 60_000, timeline)).toBe(5_000);
    s = resume(s, T0 + 60_000);
    expect(elapsedMs(s, T0 + 61_000, timeline)).toBe(6_000);
    s = pause(s, T0 + 62_000);
    s = resume(s, T0 + 70_000);
    expect(elapsedMs(s, T0 + 71_000, timeline)).toBe(8_000);
  });

  it('ações inválidas no estado atual não fazem nada', () => {
    expect(pause(initialTimerState, T0)).toBe(initialTimerState);
    expect(resume(initialTimerState, T0)).toBe(initialTimerState);
    const running = start(initialTimerState, T0, timeline);
    expect(resume(running, T0)).toBe(running);
    expect(start(running, T0, timeline)).toBe(running);
  });

  it('tick finaliza ao atingir o total', () => {
    let s = start(initialTimerState, T0, timeline);
    s = tick(s, T0 + timeline.totalMs - 1, timeline);
    expect(s.status).toBe('running');
    s = tick(s, T0 + timeline.totalMs, timeline);
    expect(s.status).toBe('finished');
    expect(s.stoppedEarly).toBe(false);
    expect(snapshot(s, T0 + 999_999, timeline).totalProgress).toBe(1);
  });

  it('stop encerra cedo e congela o tempo decorrido', () => {
    let s = start(initialTimerState, T0, timeline);
    s = stop(s, T0 + 42_000, timeline);
    expect(s).toMatchObject({ status: 'finished', stoppedEarly: true, finalElapsedMs: 42_000 });
    expect(elapsedMs(s, T0 + 999_999, timeline)).toBe(42_000);
  });
});

describe('timerEngine — precisão (sem deriva)', () => {
  it('ticks irregulares não acumulam erro: o tempo vem do relógio', () => {
    let s = start(initialTimerState, T0, timeline);
    let now = T0;
    let seed = 7;
    while (now < T0 + 200_000) {
      seed = (seed * 9301 + 49297) % 233280;
      now += 16 + (seed % 400); // 16..415ms, como um JS thread ocupado
      s = tick(s, now, timeline);
    }
    expect(elapsedMs(s, now, timeline)).toBe(now - T0);
  });

  it('volta do background: salto grande cai direto na fase correta', () => {
    const s = start(initialTimerState, T0, timeline);
    const snap = snapshot(s, T0 + 10_000 + 30_000 + 10_000 + 5_000, timeline);
    expect(snap.phase?.label).toBe('Agachamento');
    expect(snap.phaseRemainingMs).toBe(25_000);
  });
});

describe('timerEngine — pular e voltar', () => {
  it('pular vai para o início da próxima fase', () => {
    let s = start(initialTimerState, T0, timeline);
    s = skip(s, T0 + 3_000, timeline); // estava no preparo
    const snap = snapshot(s, T0 + 3_000, timeline);
    expect(snap.phase?.label).toBe('Polichinelo');
    expect(snap.phaseElapsedMs).toBe(0);
    // e o relógio continua andando normalmente depois
    expect(snapshot(s, T0 + 4_000, timeline).phaseElapsedMs).toBe(1_000);
  });

  it('pular na última fase termina o treino', () => {
    let s = start(initialTimerState, T0, timeline);
    s = skip(s, T0 + timeline.totalMs - 5_000, timeline);
    expect(s.status).toBe('finished');
  });

  it('pular funciona pausado e mantém pausado', () => {
    let s = start(initialTimerState, T0, timeline);
    s = pause(s, T0 + 1_000);
    s = skip(s, T0 + 2_000, timeline);
    expect(s.status).toBe('paused');
    expect(snapshot(s, T0 + 50_000, timeline).phase?.label).toBe('Polichinelo');
  });

  it(`voltar até ${BACK_THRESHOLD_MS}ms após o início vai para a fase anterior`, () => {
    let s = start(initialTimerState, T0, timeline);
    s = back(s, T0 + 11_000, timeline); // 1s dentro do Polichinelo
    expect(snapshot(s, T0 + 11_000, timeline).phase?.kind).toBe('prepare');
  });

  it('voltar depois do limite reinicia a fase atual', () => {
    let s = start(initialTimerState, T0, timeline);
    s = back(s, T0 + 20_000, timeline); // 10s dentro do Polichinelo
    const snap = snapshot(s, T0 + 20_000, timeline);
    expect(snap.phase?.label).toBe('Polichinelo');
    expect(snap.phaseElapsedMs).toBe(0);
  });

  it('voltar na primeira fase reinicia ela', () => {
    let s = start(initialTimerState, T0, timeline);
    s = back(s, T0 + 500, timeline);
    expect(snapshot(s, T0 + 500, timeline).elapsedMs).toBe(0);
  });
});

describe('diffEvents — quando tocar sons', () => {
  const run = (from: number, to: number, step = 100) => {
    const s = start(initialTimerState, T0, timeline);
    const events: TimerEvent[] = [];
    let prev = null as ReturnType<typeof snapshot> | null;
    for (let t = from; t <= to; t += step) {
      const next = snapshot(tick(s, T0 + t, timeline), T0 + t, timeline);
      events.push(...diffEvents(prev, next, options));
      prev = next;
    }
    return events;
  };

  it('primeiro snapshot dispara o início da fase', () => {
    expect(run(0, 0)).toEqual([expect.objectContaining({ type: 'phaseStarted' })]);
  });

  it('contagem 3, 2, 1 no fim do preparo e depois início do trabalho', () => {
    const events = run(0, 10_000).map((e) =>
      e.type === 'countdown' ? `cd${e.secondsLeft}` : e.type === 'phaseStarted' ? e.phase.kind : e.type,
    );
    expect(events).toEqual(['prepare', 'cd3', 'cd2', 'cd1', 'work']);
  });

  it('em saltos grandes não há rajada: só o evento mais recente', () => {
    const s = start(initialTimerState, T0, timeline);
    const a = snapshot(s, T0 + 1_000, timeline);
    const b = snapshot(s, T0 + 100_000, timeline);
    const events = diffEvents(a, b, options);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('phaseStarted');
  });

  it('pausado não emite eventos; retomar não repete o início da fase', () => {
    let s = start(initialTimerState, T0, timeline);
    const a = snapshot(s, T0 + 1_000, timeline);
    s = pause(s, T0 + 1_000);
    const b = snapshot(s, T0 + 5_000, timeline);
    expect(diffEvents(a, b, options)).toEqual([]);
    s = resume(s, T0 + 5_000);
    const c = snapshot(s, T0 + 5_100, timeline);
    expect(diffEvents(b, c, options)).toEqual([]);
  });

  it('finished é emitido uma única vez', () => {
    let s = start(initialTimerState, T0, timeline);
    const a = snapshot(s, T0, timeline);
    s = tick(s, T0 + timeline.totalMs, timeline);
    const b = snapshot(s, T0 + timeline.totalMs, timeline);
    expect(diffEvents(a, b, options)).toEqual([{ type: 'finished', stoppedEarly: false }]);
    expect(diffEvents(b, b, options)).toEqual([]);
  });

  it('meio do trabalho só quando habilitado e em fases ≥ 10s', () => {
    const tabata = compileTimeline(createTabataWorkout());
    const s = start(initialTimerState, T0, tabata);
    const before = snapshot(s, T0 + 10_000 + 9_900, tabata);
    const after = snapshot(s, T0 + 10_000 + 10_000, tabata);
    expect(diffEvents(before, after, options)).toEqual([]);
    expect(diffEvents(before, after, { ...options, halfwayAlert: true })).toEqual([
      expect.objectContaining({ type: 'halfway' }),
    ]);
  });
});
