import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createCycle } from '@/domain/workout';
import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { createFakeBackupIO } from '@/test/fakeBackupIO';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { WorkoutDetailScreen } from '../workout-detail-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

describe('WorkoutDetailScreen — pré-treino', () => {
  beforeEach(resetRouterMock);

  async function setup() {
    const services = await createTestServices();
    const workout = planExampleWorkout({ restBetweenCyclesSec: 60 });
    workout.cycles.push(createCycle({ name: 'Core', itemCount: 2, workSec: 40, restSec: 20 }));
    await services.workouts.save(workout, null);
    await renderWithServices(<WorkoutDetailScreen workoutId={workout.id} />, services);
    return workout;
  }

  it('mostra o tempo total e o tempo de cada ciclo', async () => {
    await setup();
    // 16 + 220 + 60 + 100 = 396s
    expect(await screen.findByLabelText('Tempo total 6min36s')).toBeTruthy();
    expect(screen.getByText('6:36')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ciclo 1, 3min40s' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Core, 1min40s' })).toBeTruthy();
    expect(screen.getByText('Depois: 1min de descanso entre ciclos')).toBeTruthy();
  });

  it('expande o ciclo para ver os tempos de cada exercício', async () => {
    await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ciclo 1, 3min40s' }));
    expect(screen.getByText('3. Prancha')).toBeTruthy();
    expect(screen.getByText('60s / 10s')).toBeTruthy();
    expect(screen.getByText('5. Abdominal')).toBeTruthy();
  });

  it('mostra o som próprio de um exercício', async () => {
    const services = await createTestServices();
    const workout = planExampleWorkout();
    workout.cycles[0].items[2].workSoundId = 'gong';
    await services.workouts.save(workout, null);
    await renderWithServices(<WorkoutDetailScreen workoutId={workout.id} />, services);
    expect(await screen.findByText('♪ Gongo')).toBeTruthy();
    expect(screen.getAllByText(/♪/)).toHaveLength(1);
  });

  it('"Começar" abre o temporizador; "Editar" abre o editor', async () => {
    const workout = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: '▶ Começar' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/player/${workout.id}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/workout/${workout.id}/edit`);
  });

  it('treino inexistente mostra aviso', async () => {
    await renderWithServices(<WorkoutDetailScreen workoutId="nada" />);
    expect(await screen.findByText('Treino não encontrado.')).toBeTruthy();
  });
});

describe('WorkoutDetailScreen — compartilhar e salvar como modelo', () => {
  beforeEach(resetRouterMock);
  afterEach(() => jest.restoreAllMocks());

  async function setupShare() {
    const fake = createFakeBackupIO();
    const services = await createTestServices({ backupIO: fake.io });
    const workout = await services.workouts.save(planExampleWorkout({ name: 'Boxe' }), null);
    await renderWithServices(<WorkoutDetailScreen workoutId={workout.id} />, services);
    await screen.findByRole('button', { name: 'Compartilhar' });
    return { services, fake, workout };
  }

  it('"Compartilhar" gera o arquivo do treino pelo menu do sistema', async () => {
    const { fake } = await setupShare();
    await fireEvent.press(screen.getByRole('button', { name: 'Compartilhar' }));
    await waitFor(() => expect(fake.state.shared).toHaveLength(1));
    expect(fake.state.shared[0].fileName).toBe('boxe.dmtabata');
  });

  it('"Salvar como modelo" guarda em Meus modelos e avisa', async () => {
    const { services } = await setupShare();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar como modelo' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Modelo salvo', expect.stringContaining('Meus modelos')),
    );
    expect((await services.library.templates()).map((t) => t.name)).toEqual(['Boxe']);
  });
});
