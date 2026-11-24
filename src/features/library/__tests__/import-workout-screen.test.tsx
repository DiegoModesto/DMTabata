import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buildWorkoutFile, serializeWorkoutFile } from '@/domain/workoutFile';
import { emptySoundConfig } from '@/domain/soundConfig';
import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { createFakeBackupIO } from '@/test/fakeBackupIO';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { ImportWorkoutScreen } from '../import-workout-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

const URI = 'file:///Inbox/perna.dmtabata';

async function setup(text: string) {
  const fake = createFakeBackupIO();
  fake.state.files.set(URI, text);
  const services = await createTestServices({ backupIO: fake.io });
  await services.authStore.getState().signIn({ email: 'ana@x.com' });
  await renderWithServices(<ImportWorkoutScreen uri={URI} />, services);
  return services;
}

describe('ImportWorkoutScreen — treino aberto de outro app', () => {
  beforeEach(resetRouterMock);

  it('mostra o treino recebido e adiciona aos meus treinos', async () => {
    const config = {
      ...emptySoundConfig('c', 'S'),
      sounds: { ...emptySoundConfig('c', 'S').sounds, workStart: 'pack-corneta' },
    };
    const text = serializeWorkoutFile(
      buildWorkoutFile(planExampleWorkout({ name: 'Perna' }), config, () => true).file,
    );
    const services = await setup(text);
    expect(await screen.findByRole('header', { name: 'Perna' })).toBeTruthy();
    expect(screen.getByLabelText('Tempo total 3min56s')).toBeTruthy();
    expect(screen.getByText('Vem com os sons configurados pelo autor.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar aos meus treinos' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const [summary] = services.workoutsStore.getState().summaries;
    expect(summary.name).toBe('Perna');
    expect(mockRouter.replace).toHaveBeenCalledWith(`/workout/${summary.id}`);
  });

  it('arquivo que não é treino mostra o erro e permite fechar', async () => {
    await setup('{"qualquer":"coisa"}');
    expect(await screen.findByText('Arquivo não é um treino do DMTabata.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('cancelar não salva nada', async () => {
    const text = serializeWorkoutFile(
      buildWorkoutFile(planExampleWorkout(), null, () => true).file,
    );
    const services = await setup(text);
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    expect(await services.workouts.listSummaries(services.authStore.getState().user!.id)).toEqual(
      [],
    );
  });
});
