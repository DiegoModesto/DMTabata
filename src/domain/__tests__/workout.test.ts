import { planExampleWorkout } from '@/test/factories';

import {
  createCycle,
  createTabataWorkout,
  createWorkout,
  cycleDurationSec,
  duplicateWorkout,
  effectiveRestSec,
  effectiveWorkSec,
  isItemOverridden,
  restAfterItem,
  workoutTotals,
} from '../workout';

describe('tempos efetivos (herança do ciclo × sobrescrita do exercício)', () => {
  const workout = planExampleWorkout();
  const cycle = workout.cycles[0];

  it('itens sem sobrescrita herdam o padrão do ciclo', () => {
    expect(effectiveWorkSec(cycle, cycle.items[0])).toBe(30);
    expect(effectiveRestSec(cycle, cycle.items[0])).toBe(10);
    expect(isItemOverridden(cycle.items[0])).toBe(false);
  });

  it('o 3º exercício sobrescrito usa 60s', () => {
    expect(effectiveWorkSec(cycle, cycle.items[2])).toBe(60);
    expect(effectiveRestSec(cycle, cycle.items[2])).toBe(10);
    expect(isItemOverridden(cycle.items[2])).toBe(true);
  });

  it('o descanso do último exercício é omitido por padrão', () => {
    expect(restAfterItem(cycle, 4, 0)).toBe(0);
    expect(restAfterItem(cycle, 3, 0)).toBe(10);
  });

  it('com skipLastRest desligado, o último descanso é mantido', () => {
    expect(restAfterItem({ ...cycle, skipLastRest: false }, 4, 0)).toBe(10);
  });

  it('com repetições, o último item só perde o descanso na última repetição', () => {
    const repeated = { ...cycle, repeatCount: 3 };
    expect(restAfterItem(repeated, 4, 0)).toBe(10);
    expect(restAfterItem(repeated, 4, 1)).toBe(10);
    expect(restAfterItem(repeated, 4, 2)).toBe(0);
  });
});

describe('duração do ciclo', () => {
  it('exemplo do plano: (30+30+60+30+30) + 4×10 = 220s', () => {
    expect(cycleDurationSec(planExampleWorkout().cycles[0])).toBe(220);
  });

  it('multiplica pelas repetições', () => {
    const cycle = createCycle({ itemCount: 2, workSec: 20, restSec: 10, repeatCount: 3 });
    // 3 repetições × (20+10+20+10) − último descanso = 170
    expect(cycleDurationSec(cycle)).toBe(170);
  });
});

describe('totais do treino', () => {
  it('soma preparação, ciclos, descanso entre ciclos e desaquecimento', () => {
    const workout = planExampleWorkout({
      prepareSec: 10,
      cooldownSec: 30,
      restBetweenCyclesSec: 60,
    });
    workout.cycles.push(createCycle({ name: 'Ciclo 2', itemCount: 2, workSec: 40, restSec: 20 }));
    const totals = workoutTotals(workout);

    expect(totals.cycleDurationsSec).toEqual([220, 100]);
    expect(totals.cycleRestSec).toBe(60);
    expect(totals.workSec).toBe(180 + 80);
    expect(totals.restSec).toBe(40 + 20);
    expect(totals.totalSec).toBe(10 + 220 + 60 + 100 + 30);
    expect(totals.exerciseCount).toBe(7);
  });

  it('treino sem ciclos tem duração zero', () => {
    expect(workoutTotals(createWorkout({ cycles: [] })).totalSec).toBe(0);
  });

  it('Tabata clássico: 10s preparo + 8×20s + 7×10s = 4min', () => {
    const tabata = createTabataWorkout();
    expect(workoutTotals(tabata).totalSec).toBe(240);
    expect(tabata.type).toBe('tabata');
  });
});

describe('duplicateWorkout', () => {
  it('gera ids novos em tudo e não copia o favorito', () => {
    const source = { ...planExampleWorkout(), favorite: true };
    const copy = duplicateWorkout(source, 5_000);

    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('Treino de perna (cópia)');
    expect(copy.favorite).toBe(false);
    expect(copy.createdAt).toBe(5_000);
    expect(copy.cycles[0].id).not.toBe(source.cycles[0].id);
    copy.cycles[0].items.forEach((item, i) => {
      expect(item.id).not.toBe(source.cycles[0].items[i].id);
      expect(item.workSec).toBe(source.cycles[0].items[i].workSec);
    });
    expect(workoutTotals(copy).totalSec).toBe(workoutTotals(source).totalSec);
  });
});
