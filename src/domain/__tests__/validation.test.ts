import { planExampleWorkout } from '@/test/factories';

import { isWorkoutValid, validateWorkout } from '../validation';
import { createWorkout, LIMITS } from '../workout';

const paths = (w: Parameters<typeof validateWorkout>[0]) => validateWorkout(w).map((e) => e.path);

describe('validateWorkout — regras de negócio', () => {
  it('o exemplo do plano é válido', () => {
    expect(isWorkoutValid(planExampleWorkout())).toBe(true);
  });

  it('exige nome', () => {
    expect(paths(planExampleWorkout({ name: '   ' }))).toContain('name');
  });

  it('exige ao menos um ciclo', () => {
    expect(paths(createWorkout({ name: 'X', cycles: [] }))).toContain('cycles');
  });

  it('exige ao menos um exercício por ciclo', () => {
    const w = planExampleWorkout();
    w.cycles[0].items = [];
    expect(paths(w)).toContain('cycles.0.items');
  });

  it('trabalho precisa ser de pelo menos 1s (padrão e sobrescrito)', () => {
    const w = planExampleWorkout();
    w.cycles[0].defaultWorkSec = 0;
    w.cycles[0].items[1] = { ...w.cycles[0].items[1], workSec: 0 };
    expect(paths(w)).toEqual(
      expect.arrayContaining(['cycles.0.defaultWorkSec', 'cycles.0.items.1.workSec']),
    );
  });

  it('descanso pode ser zero, mas não negativo', () => {
    const w = planExampleWorkout();
    w.cycles[0].defaultRestSec = 0;
    expect(isWorkoutValid(w)).toBe(true);
    w.cycles[0].items[0] = { ...w.cycles[0].items[0], restSec: -1 };
    expect(paths(w)).toContain('cycles.0.items.0.restSec');
  });

  it('repetições entre 1 e 99', () => {
    const w = planExampleWorkout();
    w.cycles[0].repeatCount = 0;
    expect(paths(w)).toContain('cycles.0.repeatCount');
    w.cycles[0].repeatCount = 100;
    expect(paths(w)).toContain('cycles.0.repeatCount');
  });

  it('exige nome nos exercícios e mensagens são amigáveis', () => {
    const w = planExampleWorkout();
    w.cycles[0].items[0] = { ...w.cycles[0].items[0], label: '' };
    const errors = validateWorkout(w);
    expect(errors).toContainEqual({
      path: 'cycles.0.items.0.label',
      message: 'Dê um nome ao exercício.',
    });
  });

  it('preparação mínima de 16 s', () => {
    expect(paths(planExampleWorkout({ prepareSec: 15 }))).toContain('prepareSec');
    expect(paths(planExampleWorkout({ prepareSec: 0 }))).toContain('prepareSec');
    expect(paths(planExampleWorkout({ prepareSec: 16 }))).not.toContain('prepareSec');
    expect(validateWorkout(planExampleWorkout({ prepareSec: 10 }))).toContainEqual({
      path: 'prepareSec',
      message: 'Preparação deve estar entre 16 e 300.',
    });
  });

  it('novos treinos já nascem com a preparação mínima', () => {
    expect(createWorkout({ name: 'X' }).prepareSec).toBe(LIMITS.minPrepareSec);
  });

  it('rejeita tempos fracionados', () => {
    const w = planExampleWorkout({ prepareSec: 2.5 });
    expect(paths(w)).toContain('prepareSec');
  });
});
