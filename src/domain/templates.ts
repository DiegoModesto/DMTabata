import {
  createCycle,
  createTabataWorkout,
  createWorkout,
  type Workout,
  type WorkoutType,
} from './workout';

export type TemplateInfo = { type: WorkoutType; name: string; description: string };

export const TEMPLATES: TemplateInfo[] = [
  { type: 'tabata', name: 'Tabata', description: '8 × 20s de trabalho / 10s de descanso (4 min).' },
  { type: 'hiit', name: 'HIIT', description: '10 × 40s de trabalho / 20s de descanso.' },
  { type: 'emom', name: 'EMOM', description: 'Um exercício a cada minuto, por 10 minutos.' },
  { type: 'amrap', name: 'AMRAP', description: 'Máximo de voltas em 12 minutos, contando os rounds.' },
  {
    type: 'circuit',
    name: 'Circuito',
    description: '5 exercícios de 45s com 15s de descanso, 3 voltas.',
  },
  { type: 'custom', name: 'Personalizado', description: 'Comece do zero com 5 exercícios.' },
];

export const isWorkoutType = (value: unknown): value is WorkoutType =>
  TEMPLATES.some((t) => t.type === value);

/** Cria um treino pronto para edição a partir de um modelo. */
export function createFromTemplate(type: WorkoutType, now: number = Date.now()): Workout {
  switch (type) {
    case 'tabata':
      return createTabataWorkout(now);
    case 'hiit': {
      const cycle = createCycle({ name: 'HIIT', labels: ['Exercício'], workSec: 40, restSec: 20 });
      return createWorkout({ name: 'HIIT', type, cycles: [{ ...cycle, repeatCount: 10 }] }, now);
    }
    case 'emom': {
      // Cada minuto começa com o som de trabalho; o "descanso" é o que sobrar do minuto.
      const cycle = createCycle({ name: 'EMOM', labels: ['Exercício'], workSec: 60, restSec: 0 });
      return createWorkout({ name: 'EMOM 10 min', type, cycles: [{ ...cycle, repeatCount: 10 }] }, now);
    }
    case 'amrap': {
      const cycle = createCycle({ name: 'AMRAP', labels: ['AMRAP'], workSec: 12 * 60, restSec: 0 });
      return createWorkout({ name: 'AMRAP 12 min', type, cycles: [cycle] }, now);
    }
    case 'circuit': {
      const cycle = createCycle({
        name: 'Circuito',
        labels: ['Agachamento', 'Flexão', 'Prancha', 'Afundo', 'Polichinelo'],
        workSec: 45,
        restSec: 15,
      });
      return createWorkout(
        {
          name: 'Circuito',
          type,
          cycles: [{ ...cycle, repeatCount: 3, skipLastRest: true }],
        },
        now,
      );
    }
    case 'custom':
      return createWorkout({ name: '' }, now);
  }
}
