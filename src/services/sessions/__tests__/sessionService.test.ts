import { DEFAULT_ALERT_SETTINGS } from '@/domain/alerts';
import { compileTimeline } from '@/domain/timeline';
import { createTimerController } from '@/engine/timerController';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices } from '@/test/renderWithServices';

const DAY = 24 * 60 * 60 * 1000;
const workout = planExampleWorkout();
const timeline = compileTimeline(workout);

function logUntil(ms: number, stop = false) {
  const c = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
  c.dispatch('start', 0);
  for (let t = 100; t <= ms; t += 100) c.update(t);
  if (stop) c.dispatch('stop', ms);
  return c.getLog();
}

async function setup(now = new Date(2026, 10, 24, 18).getTime()) {
  let clock = now;
  const services = await createTestServices({ now: () => clock });
  await services.authStore.getState().signIn({ email: 'a@x.com' });
  await services.workoutsStore.getState().save(workout);
  return { ...services, setNow: (t: number) => (clock = t), now };
}

describe('sessionService — regras de registro', () => {
  it('treino completo vira sessão concluída', async () => {
    const { sessionService } = await setup();
    const id = await sessionService.start(workout, timeline);
    const result = await sessionService.finish(id, logUntil(timeline.totalMs + 200), false);
    expect(result?.summary.completionRate).toBe(1);
    expect(await sessionService.getSession(id)).toMatchObject({ status: 'completed' });
  });

  it('parar no meio vira sessão interrompida', async () => {
    const { sessionService } = await setup();
    const id = await sessionService.start(workout, timeline);
    await sessionService.finish(id, logUntil(60_000, true), true);
    expect(await sessionService.getSession(id)).toMatchObject({ status: 'abandoned', workSec: 30 + 10 });
  });

  it('sessão sem tempo de trabalho (parou no preparo) é descartada', async () => {
    const { sessionService } = await setup();
    const id = await sessionService.start(workout, timeline);
    expect(await sessionService.finish(id, logUntil(5_000, true), true)).toBeNull();
    expect(await sessionService.getSession(id)).toBeNull();
  });

  it('checkpoint guarda progresso parcial de sessão em andamento', async () => {
    const { sessionService } = await setup();
    const id = await sessionService.start(workout, timeline);
    await sessionService.checkpoint(id, logUntil(50_000));
    expect(await sessionService.getSession(id)).toMatchObject({ status: 'in_progress', workSec: 30 });
  });

  it('feedback inválido não é salvo', async () => {
    const { sessionService } = await setup();
    const id = await sessionService.start(workout, timeline);
    const errors = await sessionService.saveFeedback(id, {
      rating: 9,
      rpe: null,
      difficulty: null,
      mood: null,
      notes: null,
    });
    expect(errors).toHaveLength(1);
    expect((await sessionService.getSession(id))?.feedback).toBeNull();
  });
});

describe('sessionService — estatísticas', () => {
  async function seedHistory() {
    const ctx = await setup();
    const make = async (daysAgo: number, rating: number | null, stopAt?: number) => {
      ctx.setNow(ctx.now - daysAgo * DAY);
      const id = await ctx.sessionService.start(workout, timeline);
      await ctx.sessionService.finish(
        id,
        stopAt ? logUntil(stopAt, true) : logUntil(timeline.totalMs + 200),
        !!stopAt,
      );
      if (rating) {
        await ctx.sessionService.saveFeedback(id, { rating, rpe: 6, difficulty: null, mood: null, notes: null });
      }
    };
    await make(0, 5);
    await make(1, 3);
    await make(2, null, 60_000);
    await make(40, 4);
    ctx.setNow(ctx.now);
    return ctx;
  }

  it('estatísticas do treino respeitam o período', async () => {
    const { sessionService } = await seedHistory();
    const month = await sessionService.workoutStats(workout.id, '30d');
    expect(month.summary).toMatchObject({ sessions: 3, completed: 2, avgRating: 4, avgRpe: 6 });
    const all = await sessionService.workoutStats(workout.id, 'all');
    expect(all.summary.sessions).toBe(4);
    expect(all.weekly).toHaveLength(8);
  });

  it('visão geral: semana, mês, sequência e recentes', async () => {
    const { sessionService, authStore } = await seedHistory();
    const overview = await sessionService.overview(authStore.getState().user!.id);
    expect(overview.week.sessions).toBe(3);
    expect(overview.month.sessions).toBe(3);
    expect(overview.streak).toBe(3);
    expect(overview.recent).toHaveLength(4);
    expect(overview.topWorkouts).toEqual([{ workoutId: workout.id, name: 'Treino de perna', count: 3 }]);
  });

  it('ao abrir o app, sessões que ficaram abertas viram interrompidas', async () => {
    const { sessionService } = await setup();
    const id = await sessionService.start(workout, timeline);
    expect(await sessionService.abandonStale()).toBe(1);
    expect((await sessionService.getSession(id))?.status).toBe('abandoned');
  });
});
