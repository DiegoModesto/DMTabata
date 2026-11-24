import { planExampleWorkout } from '@/test/factories';

import { createWorkout, LIMITS, workoutTotals } from '../workout';
import { editorReducer, nextCycleName, type EditorAction } from '../workoutEditor';

const apply = (actions: EditorAction[], start = planExampleWorkout()) =>
  actions.reduce(editorReducer, start);

describe('editorReducer — tempos por exercício', () => {
  it('cenário do plano: ciclo de 5 × 30s/10s com o 3º exercício em 60s', () => {
    let w = createWorkout({ name: 'Perna', prepareSec: 10 });
    const cycleId = w.cycles[0].id;
    w = apply(
      [
        { type: 'setItemCount', cycleId, count: 5 },
        { type: 'updateCycle', cycleId, changes: { defaultWorkSec: 30, defaultRestSec: 10 } },
      ],
      w,
    );
    const third = w.cycles[0].items[2];
    w = editorReducer(w, {
      type: 'updateItem',
      cycleId,
      itemId: third.id,
      changes: { workSec: 60 },
    });

    expect(w.cycles[0].items.map((i) => i.workSec)).toEqual([null, null, 60, null, null]);
    expect(workoutTotals(w).cycleDurationsSec[0]).toBe(220);
  });

  it('mudar o padrão do ciclo afeta só quem não foi sobrescrito', () => {
    const w = planExampleWorkout();
    const cycleId = w.cycles[0].id;
    const next = editorReducer(w, {
      type: 'updateCycle',
      cycleId,
      changes: { defaultWorkSec: 45 },
    });
    expect(next.cycles[0].defaultWorkSec).toBe(45);
    expect(next.cycles[0].items[0].workSec).toBeNull();
    expect(next.cycles[0].items[2].workSec).toBe(60);
  });

  it('sobrescrita igual ao padrão volta a herdar (null)', () => {
    const w = planExampleWorkout();
    const { id: cycleId, items } = w.cycles[0];
    const next = editorReducer(w, {
      type: 'updateItem',
      cycleId,
      itemId: items[2].id,
      changes: { workSec: 30 },
    });
    expect(next.cycles[0].items[2].workSec).toBeNull();
  });

  it('se o padrão do ciclo passar a ser igual à sobrescrita, o item volta a herdar', () => {
    const w = planExampleWorkout();
    const next = editorReducer(w, {
      type: 'updateCycle',
      cycleId: w.cycles[0].id,
      changes: { defaultWorkSec: 60 },
    });
    expect(next.cycles[0].items[2].workSec).toBeNull();
  });

  it('resetItemTimes remove as sobrescritas', () => {
    const w = planExampleWorkout();
    const { id: cycleId, items } = w.cycles[0];
    const next = editorReducer(w, { type: 'resetItemTimes', cycleId, itemId: items[2].id });
    expect(next.cycles[0].items[2]).toMatchObject({ workSec: null, restSec: null });
  });

  it('limita tempos: trabalho ≥ 1s, descanso ≥ 0, máximo 1h', () => {
    const w = planExampleWorkout();
    const { id: cycleId, items } = w.cycles[0];
    const next = apply(
      [
        { type: 'updateItem', cycleId, itemId: items[0].id, changes: { workSec: -5, restSec: -5 } },
        { type: 'updateItem', cycleId, itemId: items[1].id, changes: { workSec: 99_999 } },
      ],
      w,
    );
    expect(next.cycles[0].items[0]).toMatchObject({ workSec: 1, restSec: 0 });
    expect(next.cycles[0].items[1].workSec).toBe(LIMITS.maxPhaseSec);
  });

  it('define e remove sons específicos do exercício', () => {
    const w = planExampleWorkout();
    const { id: cycleId, items } = w.cycles[0];
    let next = editorReducer(w, {
      type: 'updateItem',
      cycleId,
      itemId: items[2].id,
      changes: { workSoundId: 'horn', restSoundId: 'silent' },
    });
    expect(next.cycles[0].items[2]).toMatchObject({
      workSoundId: 'horn',
      restSoundId: 'silent',
      workSec: 60,
    });
    next = editorReducer(next, {
      type: 'updateItem',
      cycleId,
      itemId: items[2].id,
      changes: { workSoundId: null },
    });
    expect(next.cycles[0].items[2]).toMatchObject({ workSoundId: null, restSoundId: 'silent' });
  });

  it('renomear exercício mantém os tempos', () => {
    const w = planExampleWorkout();
    const { id: cycleId, items } = w.cycles[0];
    const next = editorReducer(w, {
      type: 'updateItem',
      cycleId,
      itemId: items[2].id,
      changes: { label: 'Prancha lateral' },
    });
    expect(next.cycles[0].items[2]).toMatchObject({ label: 'Prancha lateral', workSec: 60 });
  });
});

describe('editorReducer — estrutura', () => {
  it('setItemCount adiciona no fim e remove do fim preservando os existentes', () => {
    const w = planExampleWorkout();
    const cycleId = w.cycles[0].id;
    const more = editorReducer(w, { type: 'setItemCount', cycleId, count: 7 });
    expect(more.cycles[0].items.map((i) => i.label).slice(5)).toEqual([
      'Exercício 6',
      'Exercício 7',
    ]);
    expect(more.cycles[0].items[2].workSec).toBe(60);
    const fewer = editorReducer(more, { type: 'setItemCount', cycleId, count: 2 });
    expect(fewer.cycles[0].items.map((i) => i.label)).toEqual(['Polichinelo', 'Agachamento']);
    expect(
      editorReducer(w, { type: 'setItemCount', cycleId, count: 0 }).cycles[0].items,
    ).toHaveLength(1);
  });

  it('adiciona ciclos herdando os tempos padrão do último', () => {
    const next = editorReducer(planExampleWorkout(), { type: 'addCycle' });
    expect(next.cycles).toHaveLength(2);
    expect(next.cycles[1]).toMatchObject({
      name: 'Ciclo 2',
      defaultWorkSec: 30,
      defaultRestSec: 10,
    });
  });

  it('duplica ciclo logo abaixo, com ids novos', () => {
    const w = planExampleWorkout();
    const next = editorReducer(w, { type: 'duplicateCycle', cycleId: w.cycles[0].id });
    expect(next.cycles).toHaveLength(2);
    expect(next.cycles[1].id).not.toBe(w.cycles[0].id);
    expect(next.cycles[1].items[2].workSec).toBe(60);
    expect(next.cycles[1].items[0].id).not.toBe(w.cycles[0].items[0].id);
  });

  it('move ciclos e exercícios; ignora movimentos fora dos limites', () => {
    let w = editorReducer(planExampleWorkout(), { type: 'addCycle' });
    const [a, b] = w.cycles;
    w = editorReducer(w, { type: 'moveCycle', cycleId: b.id, direction: -1 });
    expect(w.cycles.map((c) => c.id)).toEqual([b.id, a.id]);
    expect(
      editorReducer(w, { type: 'moveCycle', cycleId: b.id, direction: -1 }).cycles.map((c) => c.id),
    ).toEqual([b.id, a.id]);

    const items = a.items;
    w = editorReducer(w, { type: 'moveItem', cycleId: a.id, itemId: items[2].id, direction: -1 });
    expect(w.cycles[1].items.map((i) => i.label)).toEqual([
      'Polichinelo',
      'Prancha',
      'Agachamento',
      'Burpee',
      'Abdominal',
    ]);
  });

  it('remove ciclos e exercícios', () => {
    let w = editorReducer(planExampleWorkout(), { type: 'addCycle' });
    w = editorReducer(w, { type: 'removeCycle', cycleId: w.cycles[1].id });
    expect(w.cycles).toHaveLength(1);
    w = editorReducer(w, {
      type: 'removeItem',
      cycleId: w.cycles[0].id,
      itemId: w.cycles[0].items[0].id,
    });
    expect(w.cycles[0].items).toHaveLength(4);
  });

  it('respeita o máximo de ciclos', () => {
    let w = planExampleWorkout();
    for (let i = 0; i < LIMITS.maxCycles + 5; i++) w = editorReducer(w, { type: 'addCycle' });
    expect(w.cycles).toHaveLength(LIMITS.maxCycles);
  });

  it('ajusta campos gerais com limites', () => {
    const w = apply([
      { type: 'setName', name: 'x'.repeat(100) },
      { type: 'setPrepare', seconds: 999 },
      { type: 'setRestBetweenCycles', seconds: -10 },
      { type: 'setCooldown', seconds: 12.6 },
    ]);
    expect(w.name).toHaveLength(LIMITS.nameMaxLength);
    expect(w.prepareSec).toBe(LIMITS.maxPrepareSec);
    expect(w.restBetweenCyclesSec).toBe(0);
    expect(w.cooldownSec).toBe(13);
  });

  it('preparação não desce abaixo do mínimo de 16 s', () => {
    expect(apply([{ type: 'setPrepare', seconds: 5 }]).prepareSec).toBe(LIMITS.minPrepareSec);
    expect(apply([{ type: 'setPrepare', seconds: 0 }]).prepareSec).toBe(16);
    expect(apply([{ type: 'setPrepare', seconds: 20 }]).prepareSec).toBe(20);
  });

  it('repetições entre 1 e 99', () => {
    const w = planExampleWorkout();
    const cycleId = w.cycles[0].id;
    expect(
      editorReducer(w, { type: 'updateCycle', cycleId, changes: { repeatCount: 0 } }).cycles[0]
        .repeatCount,
    ).toBe(1);
    expect(
      editorReducer(w, { type: 'updateCycle', cycleId, changes: { repeatCount: 500 } }).cycles[0]
        .repeatCount,
    ).toBe(99);
  });

  it('não muta o estado anterior', () => {
    const w = planExampleWorkout();
    const snapshot = JSON.stringify(w);
    editorReducer(w, { type: 'setItemCount', cycleId: w.cycles[0].id, count: 9 });
    expect(JSON.stringify(w)).toBe(snapshot);
  });
});

describe('nextCycleName', () => {
  it('evita nomes repetidos', () => {
    const w = planExampleWorkout();
    expect(nextCycleName(w.cycles)).toBe('Ciclo 2');
    expect(nextCycleName([{ ...w.cycles[0], name: 'Ciclo 2' }])).toBe('Ciclo 3');
  });
});
