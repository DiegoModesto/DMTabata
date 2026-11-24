import { createFromTemplate, isWorkoutType, TEMPLATES } from '../templates';
import { validateWorkout } from '../validation';
import { workoutTotals } from '../workout';

describe('modelos de treino', () => {
  it.each([
    ['tabata', 240],
    ['hiit', 10 + 10 * 40 + 9 * 20],
    ['emom', 10 + 10 * 60],
    ['amrap', 10 + 12 * 60],
    ['circuit', 10 + 15 * 45 + 14 * 15],
  ] as const)('%s tem a duração esperada e é válido', (type, total) => {
    const workout = createFromTemplate(type, 0);
    expect(workout.type).toBe(type);
    expect(workoutTotals(workout).totalSec).toBe(total);
    expect(validateWorkout(workout)).toEqual([]);
  });

  it('personalizado começa sem nome (usuário precisa nomear)', () => {
    const custom = createFromTemplate('custom');
    expect(custom.name).toBe('');
    expect(custom.cycles[0].items).toHaveLength(5);
  });

  it('cada chamada gera ids novos', () => {
    expect(createFromTemplate('hiit').id).not.toBe(createFromTemplate('hiit').id);
  });

  it('todo modelo listado é um tipo válido', () => {
    TEMPLATES.forEach((t) => expect(isWorkoutType(t.type)).toBe(true));
    expect(isWorkoutType('yoga')).toBe(false);
    expect(isWorkoutType(undefined)).toBe(false);
  });
});
