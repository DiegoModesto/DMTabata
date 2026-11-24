import { planExampleWorkout } from '@/test/factories';
import { createTestServices } from '@/test/renderWithServices';

async function setup() {
  const services = await createTestServices();
  await services.authStore.getState().signIn({ email: 'a@x.com' });
  return services;
}

describe('workoutsStore', () => {
  it('carrega vazio e depois reflete treinos salvos', async () => {
    const { workoutsStore } = await setup();
    await workoutsStore.getState().load();
    expect(workoutsStore.getState()).toMatchObject({ loaded: true, summaries: [] });
    await workoutsStore.getState().save(planExampleWorkout());
    expect(workoutsStore.getState().summaries).toHaveLength(1);
  });

  it('treinos pertencem ao usuário logado', async () => {
    const services = await setup();
    await services.workoutsStore.getState().save(planExampleWorkout());
    await services.authStore.getState().signIn({ email: 'outra@x.com' });
    await services.workoutsStore.getState().load();
    expect(services.workoutsStore.getState().summaries).toEqual([]);
  });

  it('cria Tabata clássico de 4min06s', async () => {
    const { workoutsStore } = await setup();
    const tabata = await workoutsStore.getState().createTabata();
    expect(tabata.name).toBe('Tabata clássico');
    expect(workoutsStore.getState().summaries[0]).toMatchObject({ totalSec: 246 });
  });

  it('duplica, favorita e remove', async () => {
    const { workoutsStore } = await setup();
    const saved = await workoutsStore.getState().save(planExampleWorkout());
    const copy = await workoutsStore.getState().duplicate(saved.id);
    expect(copy?.name).toBe('Treino de perna (cópia)');
    expect(workoutsStore.getState().summaries).toHaveLength(2);

    await workoutsStore.getState().toggleFavorite(saved.id);
    expect(workoutsStore.getState().summaries[0]).toMatchObject({ id: saved.id, favorite: true });
    await workoutsStore.getState().toggleFavorite(saved.id);
    expect(workoutsStore.getState().summaries.find((s) => s.id === saved.id)?.favorite).toBe(false);

    await workoutsStore.getState().remove(saved.id);
    expect(workoutsStore.getState().summaries.map((s) => s.id)).toEqual([copy!.id]);
    expect(await workoutsStore.getState().duplicate('inexistente')).toBeNull();
  });
});
