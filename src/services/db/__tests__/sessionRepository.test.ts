import { DEFAULT_ALERT_SETTINGS } from '@/domain/alerts';
import { summarizeSession } from '@/domain/sessionRecorder';
import { compileTimeline } from '@/domain/timeline';
import { createTimerController } from '@/engine/timerController';
import { planExampleWorkout } from '@/test/factories';
import { createMigratedTestDatabase } from '@/test/sqliteTestDatabase';

import { createSessionRepository } from '../repositories/sessionRepository';
import { createUserRepository } from '../repositories/userRepository';
import { createWorkoutRepository } from '../repositories/workoutRepository';

const workout = planExampleWorkout();
const timeline = compileTimeline(workout);

function fullLog(skipAt?: number) {
  const c = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
  c.dispatch('start', 0);
  for (let t = 100; t <= timeline.totalMs + 500; t += 100) {
    if (skipAt && t === skipAt) c.dispatch('skip', t);
    else c.update(t);
  }
  return c.getLog();
}

async function setup() {
  const db = await createMigratedTestDatabase();
  const users = createUserRepository(db);
  const workouts = createWorkoutRepository(db);
  const sessions = createSessionRepository(db);
  const user = await users.create({ displayName: 'A', email: 'a@x.com' });
  await workouts.save(workout, user.id);
  return { db, users, workouts, sessions, user };
}

describe('sessionRepository', () => {
  it('ciclo de vida: em andamento → checkpoint → concluída com fases', async () => {
    const { sessions } = await setup();
    const id = await sessions.start(workout, timeline.totalMs, 1_000);
    expect(await sessions.getById(id)).toMatchObject({
      status: 'in_progress',
      plannedSec: 230,
      workoutName: 'Treino de perna',
    });
    expect(await sessions.list()).toEqual([]); // em andamento não aparece

    const log = fullLog();
    await sessions.checkpoint(id, summarizeSession(log));
    await sessions.finish(id, { status: 'completed', endedAt: 300_000, log, summary: summarizeSession(log) });

    const saved = await sessions.getById(id);
    expect(saved).toMatchObject({
      status: 'completed',
      endedAt: 300_000,
      workSec: 180,
      restSec: 40,
      phasesCompleted: 10,
      phasesTotal: 10,
      feedback: null,
    });
    const phases = await sessions.phases(id);
    expect(phases).toHaveLength(10);
    expect(phases[3]).toMatchObject({ kind: 'work', exerciseLabel: 'Agachamento', plannedMs: 30_000, actualMs: 30_000 });
    expect(phases[0].exerciseLabel).toBeNull();
  });

  it('finalizar de novo substitui as fases (não duplica)', async () => {
    const { sessions } = await setup();
    const id = await sessions.start(workout, timeline.totalMs, 0);
    const log = fullLog();
    const summary = summarizeSession(log);
    await sessions.finish(id, { status: 'completed', endedAt: 1, log, summary });
    await sessions.finish(id, { status: 'completed', endedAt: 2, log, summary });
    expect(await sessions.phases(id)).toHaveLength(10);
  });

  it('abandonStale converte sessões em andamento em interrompidas', async () => {
    const { sessions } = await setup();
    const id = await sessions.start(workout, timeline.totalMs, 0);
    expect(await sessions.abandonStale(5_000)).toBe(1);
    expect(await sessions.getById(id)).toMatchObject({ status: 'abandoned', endedAt: 5_000 });
    expect(await sessions.abandonStale(6_000)).toBe(0);
  });

  it('feedback: grava, atualiza e limpa observações em branco', async () => {
    const { sessions } = await setup();
    const id = await sessions.start(workout, timeline.totalMs, 0);
    await sessions.saveFeedback(id, { rating: 4, rpe: 7, difficulty: 'ideal', mood: 'otimo', notes: ' boa ' });
    expect((await sessions.getById(id))?.feedback).toEqual({
      rating: 4,
      rpe: 7,
      difficulty: 'ideal',
      mood: 'otimo',
      notes: 'boa',
    });
    await sessions.saveFeedback(id, { rating: 5, rpe: null, difficulty: null, mood: null, notes: '  ' });
    expect((await sessions.getById(id))?.feedback).toEqual({
      rating: 5,
      rpe: null,
      difficulty: null,
      mood: null,
      notes: null,
    });
  });

  it('lista por treino, usuário e período, mais recentes primeiro', async () => {
    const { sessions, users, workouts } = await setup();
    const other = await users.create({ displayName: 'B', email: 'b@x.com' });
    const otherWorkout = { ...planExampleWorkout(), name: 'Do outro' };
    await workouts.save(otherWorkout, other.id);
    const log = fullLog();
    const summary = summarizeSession(log);
    const make = async (w: typeof workout, startedAt: number) => {
      const id = await sessions.start(w, timeline.totalMs, startedAt);
      await sessions.finish(id, { status: 'completed', endedAt: startedAt + 1, log, summary });
      return id;
    };
    const a1 = await make(workout, 1_000);
    const a2 = await make(workout, 5_000);
    await make(otherWorkout, 3_000);

    expect((await sessions.list({ workoutId: workout.id })).map((s) => s.id)).toEqual([a2, a1]);
    expect(await sessions.list({ userId: other.id })).toHaveLength(1);
    expect((await sessions.list({ since: 4_000 })).map((s) => s.id)).toEqual([a2]);
    expect(await sessions.list()).toHaveLength(3);
  });

  it('excluir o treino mantém o histórico (nome vem da cópia salva)', async () => {
    const { sessions, workouts, user } = await setup();
    const id = await sessions.start(workout, timeline.totalMs, 0);
    const log = fullLog();
    await sessions.finish(id, { status: 'completed', endedAt: 1, log, summary: summarizeSession(log) });
    await workouts.remove(workout.id);
    const record = await sessions.getById(id);
    expect(record).toMatchObject({ workoutId: null, workoutName: 'Treino de perna' });
    expect(await sessions.list({ userId: user.id })).toHaveLength(1);
  });

  it('lista exercícios pulados e não concluídos', async () => {
    const { sessions } = await setup();
    const log = fullLog(10_000 + 5_000); // pula o Polichinelo após 5s
    const id = await sessions.start(workout, timeline.totalMs, 0);
    await sessions.finish(id, { status: 'completed', endedAt: 1, log, summary: summarizeSession(log) });
    expect(await sessions.skippedExerciseLabels([id])).toEqual(['Polichinelo']);
    expect(await sessions.skippedExerciseLabels([])).toEqual([]);
  });
});
