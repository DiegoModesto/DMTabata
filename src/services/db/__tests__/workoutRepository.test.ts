import { createCycle, createTabataWorkout, workoutTotals } from '@/domain/workout';
import { planExampleWorkout } from '@/test/factories';
import { createMigratedTestDatabase } from '@/test/sqliteTestDatabase';

import { createUserRepository } from '../repositories/userRepository';
import { createWorkoutRepository } from '../repositories/workoutRepository';

async function setup() {
  const db = await createMigratedTestDatabase();
  let clock = 10_000;
  const repo = createWorkoutRepository(db, () => ++clock);
  const users = createUserRepository(db);
  const user = await users.create({ displayName: 'A', email: 'a@x.com' });
  return { db, repo, users, user };
}

describe('workoutRepository', () => {
  it('salva e recarrega o treino completo, preservando sobrescritas e ordem', async () => {
    const { repo, user } = await setup();
    const workout = planExampleWorkout();
    await repo.save(workout, user.id);

    const loaded = await repo.getById(workout.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.cycles[0].items.map((i) => i.label)).toEqual([
      'Polichinelo',
      'Agachamento',
      'Prancha',
      'Burpee',
      'Abdominal',
    ]);
    expect(loaded!.cycles[0].items.map((i) => i.workSec)).toEqual([null, null, 60, null, null]);
    expect(loaded!.cycles[0].skipLastRest).toBe(true);
    expect(workoutTotals(loaded!).totalSec).toBe(workoutTotals(workout).totalSec);
  });

  it('salvar de novo substitui ciclos e exercícios (removidos somem)', async () => {
    const { repo, db, user } = await setup();
    const workout = planExampleWorkout();
    await repo.save(workout, user.id);

    const edited = {
      ...workout,
      name: 'Editado',
      cycles: [{ ...workout.cycles[0], items: workout.cycles[0].items.slice(0, 2) }, createCycle()],
    };
    const saved = await repo.save(edited, user.id);
    const loaded = await repo.getById(workout.id);

    expect(loaded!.name).toBe('Editado');
    expect(loaded!.cycles).toHaveLength(2);
    expect(loaded!.cycles[0].items).toHaveLength(2);
    expect(saved.updatedAt).toBeGreaterThan(workout.updatedAt);
    expect(loaded!.createdAt).toBe(workout.createdAt);
    const items = await db.getAllAsync('SELECT id FROM cycle_items');
    expect(items).toHaveLength(2 + 5);
  });

  it('lista resumos do usuário com favoritos primeiro e depois mais recentes', async () => {
    const { repo, users, user } = await setup();
    const other = await users.create({ displayName: 'B', email: 'b@x.com' });
    const a = await repo.save({ ...planExampleWorkout(), name: 'A' }, user.id);
    const b = await repo.save({ ...createTabataWorkout(), name: 'B' }, user.id);
    await repo.save({ ...createTabataWorkout(), name: 'De outro' }, other.id);
    await repo.setFavorite(a.id, true);

    const summaries = await repo.listSummaries(user.id);
    expect(summaries.map((s) => s.name)).toEqual(['A', 'B']);
    expect(summaries[0]).toMatchObject({
      favorite: true,
      cycleCount: 1,
      exerciseCount: 5,
      totalSec: 236,
    });
    expect(summaries[1]).toMatchObject({ id: b.id, totalSec: 246 });
  });

  it('remove o treino em cascata', async () => {
    const { repo, db, user } = await setup();
    const w = planExampleWorkout();
    await repo.save(w, user.id);
    await repo.remove(w.id);
    expect(await repo.getById(w.id)).toBeNull();
    expect(await db.getAllAsync('SELECT * FROM cycles')).toHaveLength(0);
    expect(await db.getAllAsync('SELECT * FROM cycle_items')).toHaveLength(0);
  });

  it('getById de id inexistente retorna null', async () => {
    const { repo } = await setup();
    expect(await repo.getById('nada')).toBeNull();
  });

  it('salvar é atômico: erro no meio não deixa treino pela metade', async () => {
    const { repo, db, user } = await setup();
    const w = planExampleWorkout();
    // id duplicado de item força falha de PRIMARY KEY no meio da transação
    w.cycles[0].items[1] = { ...w.cycles[0].items[1], id: w.cycles[0].items[0].id };
    await expect(repo.save(w, user.id)).rejects.toThrow();
    expect(await db.getAllAsync('SELECT * FROM workouts')).toHaveLength(0);
  });
});
