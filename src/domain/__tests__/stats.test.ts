import {
  currentStreak,
  filterByPeriod,
  isFeedbackEmpty,
  mostSkipped,
  periodStart,
  summarize,
  topWorkouts,
  validateFeedback,
  weeklyCounts,
  weekStart,
  type SessionRecord,
} from '../stats';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 24, 18); // terça-feira

let seq = 0;
function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `s${++seq}`,
    workoutId: 'w1',
    workoutName: 'Treino',
    startedAt: NOW,
    endedAt: NOW,
    status: 'completed',
    plannedSec: 230,
    workSec: 180,
    restSec: 40,
    pausedSec: 0,
    phasesCompleted: 10,
    phasesSkipped: 0,
    phasesTotal: 10,
    feedback: null,
    ...overrides,
  };
}

describe('feedback', () => {
  const empty = { rating: null, rpe: null, difficulty: null, mood: null, notes: null };

  it('tudo opcional; valida faixas e tamanho das observações', () => {
    expect(validateFeedback(empty)).toEqual([]);
    expect(validateFeedback({ ...empty, rating: 5, rpe: 10 })).toEqual([]);
    expect(validateFeedback({ ...empty, rating: 0 })).toEqual(['Nota deve ser de 1 a 5.']);
    expect(validateFeedback({ ...empty, rpe: 11 })).toEqual(['Esforço deve ser de 1 a 10.']);
    expect(validateFeedback({ ...empty, rating: 3.5 })).toHaveLength(1);
    expect(validateFeedback({ ...empty, notes: 'x'.repeat(501) })).toHaveLength(1);
  });

  it('detecta feedback vazio', () => {
    expect(isFeedbackEmpty(empty)).toBe(true);
    expect(isFeedbackEmpty({ ...empty, notes: '   ' })).toBe(true);
    expect(isFeedbackEmpty({ ...empty, mood: 'otimo' })).toBe(false);
  });
});

describe('período', () => {
  it('7 dias = hoje e os 6 dias anteriores, a partir da meia-noite', () => {
    expect(periodStart('7d', NOW)).toBe(new Date(2026, 10, 18).getTime());
    expect(periodStart('all', NOW)).toBeNull();
  });

  it('filtra sessões pelo período', () => {
    const list = [session({ startedAt: at(2026, 11, 18, 0) }), session({ startedAt: at(2026, 11, 17, 23) })];
    expect(filterByPeriod(list, '7d', NOW)).toHaveLength(1);
    expect(filterByPeriod(list, 'all', NOW)).toHaveLength(2);
  });
});

describe('summarize', () => {
  it('soma tempos e faz médias ignorando avaliações vazias e sessões em andamento', () => {
    const list = [
      session({ workSec: 100, restSec: 20, phasesCompleted: 5, feedback: { rating: 4, rpe: 8, difficulty: null, mood: null, notes: null } }),
      session({ workSec: 60, restSec: 10, status: 'abandoned', phasesCompleted: 2, startedAt: NOW - 1000 }),
      session({ feedback: { rating: 2, rpe: null, difficulty: null, mood: null, notes: null } }),
      session({ status: 'in_progress', workSec: 999 }),
    ];
    const s = summarize(list);
    expect(s.sessions).toBe(3);
    expect(s.completed).toBe(2);
    expect(s.totalSec).toBe(120 + 70 + 220);
    expect(s.totalWorkSec).toBe(340);
    expect(s.avgRating).toBe(3);
    expect(s.avgRpe).toBe(8);
    expect(s.avgCompletion).toBeCloseTo((0.5 + 0.2 + 1) / 3);
    expect(s.lastSessionAt).toBe(NOW);
  });

  it('sem sessões: médias nulas', () => {
    expect(summarize([])).toMatchObject({ sessions: 0, avgRating: null, avgCompletion: null, lastSessionAt: null });
  });
});

describe('sequência de dias (streak)', () => {
  it('conta dias consecutivos até hoje', () => {
    const list = [at(2026, 11, 24), at(2026, 11, 23), at(2026, 11, 22), at(2026, 11, 20)].map((t) =>
      session({ startedAt: t }),
    );
    expect(currentStreak(list, NOW)).toBe(3);
  });

  it('não zera se ainda não treinou hoje (conta até ontem)', () => {
    const list = [at(2026, 11, 23), at(2026, 11, 22)].map((t) => session({ startedAt: t }));
    expect(currentStreak(list, NOW)).toBe(2);
  });

  it('zera se o último treino foi anteontem; sessões em andamento não contam', () => {
    expect(currentStreak([session({ startedAt: at(2026, 11, 22) })], NOW)).toBe(0);
    expect(currentStreak([session({ status: 'in_progress' })], NOW)).toBe(0);
  });

  it('vários treinos no mesmo dia contam como um dia', () => {
    const list = [session({ startedAt: at(2026, 11, 24, 8) }), session({ startedAt: at(2026, 11, 24, 19) })];
    expect(currentStreak(list, NOW)).toBe(1);
  });
});

describe('frequência semanal', () => {
  it('semanas começam na segunda-feira', () => {
    expect(new Date(weekStart(NOW)).getDay()).toBe(1);
    expect(weekStart(NOW)).toBe(new Date(2026, 10, 23).getTime());
  });

  it('agrupa por semana, da mais antiga à atual', () => {
    const list = [
      session({ startedAt: at(2026, 11, 24) }),
      session({ startedAt: at(2026, 11, 23) }),
      session({ startedAt: at(2026, 11, 22) }), // domingo da semana anterior
      session({ startedAt: at(2026, 10, 1) }), // fora da janela
    ];
    const weeks = weeklyCounts(list, NOW, 4);
    expect(weeks.map((w) => w.count)).toEqual([0, 0, 1, 2]);
    expect(weeks[3].weekStart).toBe(weekStart(NOW));
  });
});

describe('rankings', () => {
  it('exercícios mais pulados', () => {
    expect(mostSkipped(['Burpee', 'Prancha', 'Burpee', 'Abdominal', 'Burpee', 'Prancha'], 2)).toEqual([
      { label: 'Burpee', count: 3 },
      { label: 'Prancha', count: 2 },
    ]);
  });

  it('treinos mais realizados, separando treinos excluídos pelo nome', () => {
    const list = [
      session({ workoutId: 'a', workoutName: 'A' }),
      session({ workoutId: 'a', workoutName: 'A' }),
      session({ workoutId: 'b', workoutName: 'B' }),
      session({ workoutId: null, workoutName: 'Antigo' }),
      session({ workoutId: 'b', workoutName: 'B', status: 'in_progress' }),
    ];
    expect(topWorkouts(list)).toEqual([
      { workoutId: 'a', name: 'A', count: 2 },
      { workoutId: 'b', name: 'B', count: 1 },
      { workoutId: null, name: 'Antigo', count: 1 },
    ]);
  });
});
