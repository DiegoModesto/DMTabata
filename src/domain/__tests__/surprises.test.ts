import { compileTimeline } from '../timeline';
import { createTabataWorkout } from '../workout';
import { cleanSurprisePool, dueSurprises, planSurprises, SURPRISE_RULES } from '../surprises';
import { planExampleWorkout } from '@/test/factories';

/** Gerador determinístico que devolve a sequência dada (em ciclo). */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const tabata = compileTimeline(createTabataWorkout()); // 8 trabalhos de 20 s
const workPhases = tabata.phases.filter((p) => p.kind === 'work');
const pool = ['chicote', 'risada', 'seiya'];

describe('planSurprises — sorteio dos sons surpresa', () => {
  it('sem sons ou com chance zero, não sorteia nada', () => {
    expect(planSurprises(tabata, { surpriseSounds: [], surpriseChance: 1 }, seq(0))).toEqual([]);
    expect(planSurprises(tabata, { surpriseSounds: pool, surpriseChance: 0 }, seq(0))).toEqual([]);
  });

  it('chance 100%: uma surpresa em cada fase de trabalho, só no trabalho', () => {
    const plan = planSurprises(tabata, { surpriseSounds: pool, surpriseChance: 1 }, Math.random);
    expect(plan).toHaveLength(workPhases.length);
    expect(plan.map((s) => s.phaseIndex)).toEqual(workPhases.map((p) => p.index));
  });

  it('a chance decide fase a fase (sorteio abaixo da chance entra)', () => {
    // por fase: [chance, posição, som]; alterna 0.1 (entra) e 0.9 (fica de fora)
    const random = seq(0.1, 0.5, 0, 0.9);
    const plan = planSurprises(tabata, { surpriseSounds: pool, surpriseChance: 0.5 }, random);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThan(workPhases.length);
  });

  it('o momento fica na janela segura: depois do som de início e antes da contagem final', () => {
    for (const r of [0, 0.5, 0.999]) {
      const plan = planSurprises(tabata, { surpriseSounds: pool, surpriseChance: 1 }, seq(0, r, 0));
      for (const s of plan) {
        const phase = tabata.phases[s.phaseIndex];
        const offset = s.atMs - phase.startOffsetMs;
        expect(offset).toBeGreaterThanOrEqual(SURPRISE_RULES.minOffsetMs);
        expect(offset).toBeLessThanOrEqual(phase.durationMs * SURPRISE_RULES.windowEnd);
      }
    }
  });

  it('fases de trabalho curtas (< 6 s) ficam sem surpresa', () => {
    const w = planExampleWorkout();
    w.cycles[0].items = w.cycles[0].items.map((i) => ({ ...i, workSec: 5 }));
    w.cycles[0].defaultWorkSec = 5;
    const plan = planSurprises(compileTimeline(w), { surpriseSounds: pool, surpriseChance: 1 });
    expect(plan).toEqual([]);
  });

  it('não repete o mesmo som duas vezes seguidas', () => {
    const plan = planSurprises(tabata, { surpriseSounds: pool, surpriseChance: 1 }, seq(0, 0, 0));
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].soundId).not.toBe(plan[i - 1].soundId);
    }
  });

  it('com um único som, ele se repete normalmente', () => {
    const plan = planSurprises(tabata, { surpriseSounds: ['risada'], surpriseChance: 1 });
    expect(new Set(plan.map((s) => s.soundId))).toEqual(new Set(['risada']));
  });

  it('todos os sons da lista podem sair', () => {
    const plan = planSurprises(
      tabata,
      { surpriseSounds: pool, surpriseChance: 1 },
      seq(0, 0.5, 0.99),
    );
    expect(new Set(plan.map((s) => s.soundId)).size).toBeGreaterThan(1);
  });
});

describe('cleanSurprisePool', () => {
  it('remove duplicados, silencioso e vazios, com limite de tamanho', () => {
    expect(cleanSurprisePool(['a', 'a', 'silent', '', 'b'])).toEqual(['a', 'b']);
    const many = Array.from({ length: 50 }, (_, i) => `s${i}`);
    expect(cleanSurprisePool(many)).toHaveLength(SURPRISE_RULES.maxSounds);
  });
});

describe('dueSurprises — quando tocar', () => {
  const plan = [{ phaseIndex: 1, atMs: 15_000, soundId: 'chicote' }];
  const at = (elapsedMs: number, phaseIndex = 1, status = 'running') => ({
    elapsedMs,
    phaseIndex,
    status,
  });

  it('toca ao cruzar o momento sorteado, uma única vez', () => {
    expect(dueSurprises(plan, at(14_900), at(15_000))).toEqual(plan);
    expect(dueSurprises(plan, at(15_000), at(15_100))).toEqual([]);
  });

  it('não toca pausado, sem instante anterior ou ao pular entre fases', () => {
    expect(dueSurprises(plan, at(14_900), at(15_000, 1, 'paused'))).toEqual([]);
    expect(dueSurprises(plan, null, at(15_000))).toEqual([]);
    expect(dueSurprises(plan, at(9_000, 0), at(20_000, 2))).toEqual([]);
  });
});
