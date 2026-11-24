import {
  createCycle,
  createItem,
  LIMITS,
  type Cycle,
  type CycleItem,
  type Workout,
} from './workout';

/**
 * Reducer puro do editor de treino. Toda regra de edição (herança de tempos,
 * sobrescrita por exercício, reordenação, geração em lote) vive aqui e é testada
 * sem UI.
 */
export type EditorAction =
  | { type: 'setName'; name: string }
  | { type: 'setPrepare'; seconds: number }
  | { type: 'setCooldown'; seconds: number }
  | { type: 'setRestBetweenCycles'; seconds: number }
  | { type: 'addCycle' }
  | { type: 'duplicateCycle'; cycleId: string }
  | { type: 'removeCycle'; cycleId: string }
  | { type: 'moveCycle'; cycleId: string; direction: -1 | 1 }
  | {
      type: 'updateCycle';
      cycleId: string;
      changes: Partial<
        Pick<Cycle, 'name' | 'repeatCount' | 'defaultWorkSec' | 'defaultRestSec' | 'skipLastRest'>
      >;
    }
  | { type: 'addItem'; cycleId: string; label?: string }
  | { type: 'setItemCount'; cycleId: string; count: number }
  | {
      type: 'updateItem';
      cycleId: string;
      itemId: string;
      changes: Partial<Pick<CycleItem, 'label' | 'workSec' | 'restSec'>>;
    }
  | { type: 'resetItemTimes'; cycleId: string; itemId: string }
  | { type: 'removeItem'; cycleId: string; itemId: string }
  | { type: 'moveItem'; cycleId: string; itemId: string; direction: -1 | 1 };

const clampSec = (n: number, min = 0, max: number = LIMITS.maxPhaseSec) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : 0)));

function move<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function mapCycle(workout: Workout, cycleId: string, fn: (c: Cycle) => Cycle): Workout {
  return { ...workout, cycles: workout.cycles.map((c) => (c.id === cycleId ? fn(c) : c)) };
}

/**
 * Normaliza a sobrescrita: se o valor informado for igual ao padrão do ciclo,
 * guarda `null` (volta a herdar). Assim mudar o padrão depois continua refletindo.
 */
function overrideValue(value: number | null | undefined, defaultValue: number, min: number) {
  if (value === null || value === undefined) return null;
  const v = clampSec(value, min);
  return v === defaultValue ? null : v;
}

export function nextCycleName(cycles: Cycle[]): string {
  const used = new Set(cycles.map((c) => c.name));
  let n = cycles.length + 1;
  while (used.has(`Ciclo ${n}`)) n++;
  return `Ciclo ${n}`;
}

export function editorReducer(workout: Workout, action: EditorAction): Workout {
  switch (action.type) {
    case 'setName':
      return { ...workout, name: action.name.slice(0, LIMITS.nameMaxLength) };
    case 'setPrepare':
      return { ...workout, prepareSec: clampSec(action.seconds, 0, LIMITS.maxPrepareSec) };
    case 'setCooldown':
      return { ...workout, cooldownSec: clampSec(action.seconds) };
    case 'setRestBetweenCycles':
      return { ...workout, restBetweenCyclesSec: clampSec(action.seconds) };

    case 'addCycle': {
      if (workout.cycles.length >= LIMITS.maxCycles) return workout;
      const last = workout.cycles[workout.cycles.length - 1];
      const cycle = createCycle({
        name: nextCycleName(workout.cycles),
        workSec: last?.defaultWorkSec,
        restSec: last?.defaultRestSec,
      });
      return { ...workout, cycles: [...workout.cycles, cycle] };
    }

    case 'duplicateCycle': {
      if (workout.cycles.length >= LIMITS.maxCycles) return workout;
      const index = workout.cycles.findIndex((c) => c.id === action.cycleId);
      if (index < 0) return workout;
      const source = workout.cycles[index];
      const copy: Cycle = {
        ...source,
        id: createCycle().id,
        name: nextCycleName(workout.cycles),
        items: source.items.map((item) => ({ ...item, id: createItem('').id })),
      };
      const cycles = [...workout.cycles];
      cycles.splice(index + 1, 0, copy);
      return { ...workout, cycles };
    }

    case 'removeCycle':
      return { ...workout, cycles: workout.cycles.filter((c) => c.id !== action.cycleId) };

    case 'moveCycle': {
      const index = workout.cycles.findIndex((c) => c.id === action.cycleId);
      return { ...workout, cycles: move(workout.cycles, index, action.direction) };
    }

    case 'updateCycle':
      return mapCycle(workout, action.cycleId, (cycle) => {
        const { changes } = action;
        const next: Cycle = { ...cycle };
        if (changes.name !== undefined) next.name = changes.name.slice(0, LIMITS.nameMaxLength);
        if (changes.repeatCount !== undefined)
          next.repeatCount = clampSec(changes.repeatCount, LIMITS.minRepeat, LIMITS.maxRepeat);
        if (changes.defaultWorkSec !== undefined)
          next.defaultWorkSec = clampSec(changes.defaultWorkSec, LIMITS.minWorkSec);
        if (changes.defaultRestSec !== undefined)
          next.defaultRestSec = clampSec(changes.defaultRestSec);
        if (changes.skipLastRest !== undefined) next.skipLastRest = changes.skipLastRest;
        // Itens cuja sobrescrita ficou igual ao novo padrão voltam a herdar.
        next.items = next.items.map((item) => ({
          ...item,
          workSec: item.workSec === next.defaultWorkSec ? null : item.workSec,
          restSec: item.restSec === next.defaultRestSec ? null : item.restSec,
        }));
        return next;
      });

    case 'addItem':
      return mapCycle(workout, action.cycleId, (cycle) =>
        cycle.items.length >= LIMITS.maxItemsPerCycle
          ? cycle
          : {
              ...cycle,
              items: [
                ...cycle.items,
                createItem(action.label ?? `Exercício ${cycle.items.length + 1}`),
              ],
            },
      );

    case 'setItemCount':
      return mapCycle(workout, action.cycleId, (cycle) => {
        const count = Math.min(LIMITS.maxItemsPerCycle, Math.max(1, Math.round(action.count)));
        if (count <= cycle.items.length) return { ...cycle, items: cycle.items.slice(0, count) };
        const extra = Array.from({ length: count - cycle.items.length }, (_, i) =>
          createItem(`Exercício ${cycle.items.length + i + 1}`),
        );
        return { ...cycle, items: [...cycle.items, ...extra] };
      });

    case 'updateItem':
      return mapCycle(workout, action.cycleId, (cycle) => ({
        ...cycle,
        items: cycle.items.map((item) => {
          if (item.id !== action.itemId) return item;
          const { changes } = action;
          return {
            ...item,
            label:
              changes.label !== undefined
                ? changes.label.slice(0, LIMITS.nameMaxLength)
                : item.label,
            workSec:
              changes.workSec !== undefined
                ? overrideValue(changes.workSec, cycle.defaultWorkSec, LIMITS.minWorkSec)
                : item.workSec,
            restSec:
              changes.restSec !== undefined
                ? overrideValue(changes.restSec, cycle.defaultRestSec, 0)
                : item.restSec,
          };
        }),
      }));

    case 'resetItemTimes':
      return mapCycle(workout, action.cycleId, (cycle) => ({
        ...cycle,
        items: cycle.items.map((item) =>
          item.id === action.itemId ? { ...item, workSec: null, restSec: null } : item,
        ),
      }));

    case 'removeItem':
      return mapCycle(workout, action.cycleId, (cycle) => ({
        ...cycle,
        items: cycle.items.filter((item) => item.id !== action.itemId),
      }));

    case 'moveItem':
      return mapCycle(workout, action.cycleId, (cycle) => {
        const index = cycle.items.findIndex((i) => i.id === action.itemId);
        return { ...cycle, items: move(cycle.items, index, action.direction) };
      });
  }
}
