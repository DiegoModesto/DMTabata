import { timingWorkout } from '@/test/factories';

import { compileTimeline, findPhaseIndex } from '../timeline';
import { createCycle, createTabataWorkout, createWorkout, workoutTotals } from '../workout';

const kinds = (w: Parameters<typeof compileTimeline>[0]) =>
  compileTimeline(w).phases.map((p) => `${p.kind}:${p.durationMs / 1000}`);

describe('compileTimeline', () => {
  it('exemplo do plano vira a sequência esperada de fases', () => {
    expect(kinds(timingWorkout())).toEqual([
      'prepare:10',
      'work:30',
      'rest:10',
      'work:30',
      'rest:10',
      'work:60',
      'rest:10',
      'work:30',
      'rest:10',
      'work:30',
    ]);
  });

  it('offsets são contínuos e o total bate com workoutTotals', () => {
    const workout = timingWorkout();
    const { phases, totalMs } = compileTimeline(workout);
    phases.forEach((p, i) => {
      expect(p.index).toBe(i);
      if (i > 0)
        expect(p.startOffsetMs).toBe(phases[i - 1].startOffsetMs + phases[i - 1].durationMs);
    });
    expect(totalMs).toBe(workoutTotals(workout).totalSec * 1000);
  });

  it('inclui o rótulo, posição e próximo exercício em cada fase', () => {
    const { phases } = compileTimeline(timingWorkout());
    const prancha = phases.find((p) => p.label === 'Prancha')!;
    expect(prancha).toMatchObject({ kind: 'work', itemIndex: 2, totalItems: 5, cycleIndex: 0 });
    expect(phases[0].nextWorkLabel).toBe('Polichinelo');
    expect(phases[1].nextWorkLabel).toBe('Agachamento');
    expect(phases[phases.length - 1].nextWorkLabel).toBeNull();
  });

  it('Tabata: 8 trabalhos, 7 descansos, repetições numeradas', () => {
    const { phases } = compileTimeline(createTabataWorkout());
    const work = phases.filter((p) => p.kind === 'work');
    expect(work).toHaveLength(8);
    expect(phases.filter((p) => p.kind === 'rest')).toHaveLength(7);
    expect(work.map((p) => p.repeat)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(work[0].totalRepeats).toBe(8);
  });

  it('insere descanso entre ciclos (não depois do último) e desaquecimento', () => {
    const workout = createWorkout({
      name: 'X',
      prepareSec: 0,
      cooldownSec: 20,
      restBetweenCyclesSec: 45,
      cycles: [
        createCycle({ name: 'A', itemCount: 1, workSec: 10, restSec: 5 }),
        createCycle({ name: 'B', itemCount: 1, workSec: 10, restSec: 5 }),
      ],
    });
    expect(kinds(workout)).toEqual(['work:10', 'cycleRest:45', 'work:10', 'cooldown:20']);
  });

  it('omite fases de duração zero', () => {
    const workout = createWorkout({
      name: 'X',
      prepareSec: 0,
      restBetweenCyclesSec: 0,
      cycles: [
        createCycle({ itemCount: 2, workSec: 10, restSec: 0 }),
        createCycle({ itemCount: 1, workSec: 10, restSec: 0 }),
      ],
    });
    expect(kinds(workout)).toEqual(['work:10', 'work:10', 'work:10']);
  });

  it('leva o som de cada exercício para as fases de trabalho e descanso', () => {
    const workout = timingWorkout();
    workout.cycles[0].items[2] = {
      ...workout.cycles[0].items[2],
      workSoundId: 'horn',
      restSoundId: 'silent',
    };
    const { phases } = compileTimeline(workout);
    const prancha = phases.findIndex((p) => p.label === 'Prancha');
    expect(phases[prancha].soundOverride).toBe('horn');
    expect(phases[prancha + 1]).toMatchObject({ kind: 'rest', soundOverride: 'silent' });
    expect(phases[0].soundOverride).toBeNull();
    expect(phases[1].soundOverride).toBeNull();
  });

  it('treino vazio gera timeline vazia', () => {
    expect(compileTimeline(createWorkout({ cycles: [] }))).toEqual({ phases: [], totalMs: 0 });
  });

  it('propriedade: para treinos aleatórios, soma das fases = total e nenhuma fase ≤ 0', () => {
    let seed = 42;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % max;
    };
    for (let n = 0; n < 200; n++) {
      const cycles = Array.from({ length: 1 + rand(4) }, () => {
        const cycle = createCycle({
          itemCount: 1 + rand(6),
          workSec: 1 + rand(90),
          restSec: rand(30),
          repeatCount: 1 + rand(4),
        });
        cycle.skipLastRest = rand(2) === 0;
        cycle.items = cycle.items.map((item) => ({
          ...item,
          workSec: rand(3) === 0 ? 1 + rand(120) : null,
          restSec: rand(3) === 0 ? rand(40) : null,
        }));
        return cycle;
      });
      const workout = createWorkout({
        name: 'R',
        prepareSec: rand(20),
        cooldownSec: rand(20),
        restBetweenCyclesSec: rand(60),
        cycles,
      });
      const timeline = compileTimeline(workout);
      const sum = timeline.phases.reduce((acc, p) => acc + p.durationMs, 0);
      expect(sum).toBe(timeline.totalMs);
      expect(timeline.totalMs).toBe(workoutTotals(workout).totalSec * 1000);
      expect(timeline.phases.every((p) => p.durationMs > 0)).toBe(true);
    }
  });
});

describe('findPhaseIndex', () => {
  const timeline = compileTimeline(timingWorkout());

  it('encontra a fase pelo tempo decorrido', () => {
    expect(findPhaseIndex(timeline, 0)).toBe(0);
    expect(findPhaseIndex(timeline, 9_999)).toBe(0);
    expect(findPhaseIndex(timeline, 10_000)).toBe(1);
    expect(findPhaseIndex(timeline, 39_999)).toBe(1);
    expect(findPhaseIndex(timeline, 40_000)).toBe(2);
  });

  it('retorna -1 ao terminar', () => {
    expect(findPhaseIndex(timeline, timeline.totalMs)).toBe(-1);
    expect(findPhaseIndex({ phases: [], totalMs: 0 }, 0)).toBe(-1);
  });

  it('bate com busca linear em todos os instantes', () => {
    for (let t = 0; t < timeline.totalMs; t += 777) {
      const linear = timeline.phases.findIndex(
        (p) => t >= p.startOffsetMs && t < p.startOffsetMs + p.durationMs,
      );
      expect(findPhaseIndex(timeline, t)).toBe(linear);
    }
  });
});
