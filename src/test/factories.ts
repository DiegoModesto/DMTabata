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
    { name: 'Treino de perna', prepareSec: 10, cooldownSec: 0, cycles: [cycle], ...overrides },
    1_000,
  );
}

export { createCycle, createItem, createWorkout };
