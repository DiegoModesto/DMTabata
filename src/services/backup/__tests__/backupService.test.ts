import { serializeBackup, buildBackup } from '@/domain/backup';
import type { BackupIO } from '@/services/backup/backupIO';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices } from '@/test/renderWithServices';

function fakeIO() {
  const state = { shared: [] as { fileName: string; content: string }[], nextText: null as string | null };
  const io: BackupIO = {
    async share(fileName, content) {
      state.shared.push({ fileName, content });
    },
    async pickText() {
      return state.nextText;
    },
  };
  return { io, state };
}

async function setup() {
  const { io, state } = fakeIO();
  const services = await createTestServices({ backupIO: io, now: () => Date.UTC(2026, 10, 24) });
  await services.authStore.getState().signIn({ email: 'a@x.com' });
  return { ...services, state };
}

describe('backupService', () => {
  it('exporta os treinos do usuário em um arquivo datado', async () => {
    const { backupService, workoutsStore, state } = await setup();
    await workoutsStore.getState().save(planExampleWorkout());
    expect(await backupService.exportAll()).toBe(1);
    expect(state.shared[0].fileName).toBe('dmtabata-treinos-2026-11-24.json');
    expect(JSON.parse(state.shared[0].content).workouts[0].name).toBe('Treino de perna');
  });

  it('importa para o usuário atual sem sobrescrever os existentes', async () => {
    const { backupService, workoutsStore, workouts, authStore, state } = await setup();
    const existing = await workoutsStore.getState().save(planExampleWorkout());
    state.nextText = serializeBackup(buildBackup([existing]));

    expect(await backupService.importFromFile()).toEqual({ status: 'imported', imported: 1, skipped: 0 });
    const all = await workouts.listSummaries(authStore.getState().user!.id);
    expect(all).toHaveLength(2);
  });

  it('cancelar e arquivo inválido são tratados', async () => {
    const { backupService, state } = await setup();
    expect(await backupService.importFromFile()).toEqual({ status: 'canceled' });
    state.nextText = 'nada a ver';
    expect(await backupService.importFromFile()).toMatchObject({ status: 'error' });
  });
});
