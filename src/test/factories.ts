import { createCycle, createItem, createWorkout, type Workout } from '@/domain/workout';

/**
 * Exemplo do plano: 5 exercícios de 30s com 10s de descanso, o 3º com 60s.
 * Tempo do ciclo = 220s.
 */
export function planExampleWorkout(overrides: Partial<Workout> = {}): Workout {
  const cycle = createCycle({
    name: 'Ciclo 1',
    labels: ['Polichinelo', 'Agachamento', 'Prancha', 'Burpee', 'Abdominal'],
    workSec: 30,
    restSec: 10,
  });
  cycle.items[2] = { ...cycle.items[2], workSec: 60 };
  return createWorkout(
    { name: 'Treino de perna', prepareSec: 16, cooldownSec: 0, cycles: [cycle], ...overrides },
    1_000,
  );
}

export { createCycle, createItem, createWorkout };

/**
 * Exemplo do plano com 10 s de preparação, para testes de tempo do motor e do player.
 * O motor toca qualquer preparação; o mínimo de 16 s é regra de cadastro (validação,
 * editor e migração), coberta nos testes de domínio.
 */
export const timingWorkout = (overrides: Partial<Workout> = {}) =>
  planExampleWorkout({ prepareSec: 10, ...overrides });
