import { LIMITS, type Workout } from './workout';

export type ValidationError = {
  /** Caminho do campo: "name", "cycles.0.items.2.workSec"... */
  path: string;
  message: string;
};

const isInt = (n: number) => Number.isInteger(n);

function checkRange(
  errors: ValidationError[],
  path: string,
  value: number,
  min: number,
  max: number,
  label: string,
) {
  if (!isInt(value) || value < min || value > max) {
    errors.push({ path, message: `${label} deve estar entre ${min} e ${max}.` });
  }
}

export function validateWorkout(workout: Workout): ValidationError[] {
  const errors: ValidationError[] = [];
  const name = workout.name.trim();

  if (!name) errors.push({ path: 'name', message: 'Dê um nome ao treino.' });
  else if (name.length > LIMITS.nameMaxLength)
    errors.push({ path: 'name', message: `Nome com no máximo ${LIMITS.nameMaxLength} caracteres.` });

  checkRange(errors, 'prepareSec', workout.prepareSec, 0, LIMITS.maxPrepareSec, 'Preparação');
  checkRange(errors, 'cooldownSec', workout.cooldownSec, 0, LIMITS.maxPhaseSec, 'Desaquecimento');
  checkRange(
    errors,
    'restBetweenCyclesSec',
    workout.restBetweenCyclesSec,
    0,
    LIMITS.maxPhaseSec,
    'Descanso entre ciclos',
  );

  if (workout.cycles.length === 0) {
    errors.push({ path: 'cycles', message: 'Adicione pelo menos um ciclo.' });
  } else if (workout.cycles.length > LIMITS.maxCycles) {
    errors.push({ path: 'cycles', message: `No máximo ${LIMITS.maxCycles} ciclos.` });
  }

  workout.cycles.forEach((cycle, c) => {
    const base = `cycles.${c}`;
    const cycleLabel = cycle.name.trim() || `Ciclo ${c + 1}`;
    if (!cycle.name.trim()) errors.push({ path: `${base}.name`, message: 'Dê um nome ao ciclo.' });
    checkRange(
      errors,
      `${base}.repeatCount`,
      cycle.repeatCount,
      LIMITS.minRepeat,
      LIMITS.maxRepeat,
      `Repetições de "${cycleLabel}"`,
    );
    checkRange(
      errors,
      `${base}.defaultWorkSec`,
      cycle.defaultWorkSec,
      LIMITS.minWorkSec,
      LIMITS.maxPhaseSec,
      `Trabalho padrão de "${cycleLabel}"`,
    );
    checkRange(
      errors,
      `${base}.defaultRestSec`,
      cycle.defaultRestSec,
      0,
      LIMITS.maxPhaseSec,
      `Descanso padrão de "${cycleLabel}"`,
    );

    if (cycle.items.length === 0) {
      errors.push({ path: `${base}.items`, message: `"${cycleLabel}" precisa de um exercício.` });
    } else if (cycle.items.length > LIMITS.maxItemsPerCycle) {
      errors.push({
        path: `${base}.items`,
        message: `"${cycleLabel}" pode ter no máximo ${LIMITS.maxItemsPerCycle} exercícios.`,
      });
    }

    cycle.items.forEach((item, i) => {
      const itemPath = `${base}.items.${i}`;
      const itemLabel = item.label.trim() || `Exercício ${i + 1}`;
      if (!item.label.trim())
        errors.push({ path: `${itemPath}.label`, message: 'Dê um nome ao exercício.' });
      if (item.workSec !== null)
        checkRange(
          errors,
          `${itemPath}.workSec`,
          item.workSec,
          LIMITS.minWorkSec,
          LIMITS.maxPhaseSec,
          `Trabalho de "${itemLabel}"`,
        );
      if (item.restSec !== null)
        checkRange(
          errors,
          `${itemPath}.restSec`,
          item.restSec,
          0,
          LIMITS.maxPhaseSec,
          `Descanso de "${itemLabel}"`,
        );
    });
  });

  return errors;
}

export const isWorkoutValid = (workout: Workout) => validateWorkout(workout).length === 0;
