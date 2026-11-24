import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { WorkoutListScreen } from '../workout-list-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

async function setup(withWorkout = false) {
  const services = await createTestServices();
  await services.authStore.getState().signIn({ email: 'a@x.com' });
  if (withWorkout) await services.workoutsStore.getState().save(planExampleWorkout());
  await renderWithServices(<WorkoutListScreen />, services);
  return services;
}

describe('WorkoutListScreen', () => {
  beforeEach(resetRouterMock);

  it('sem treinos mostra o estado vazio com atalhos', async () => {
    await setup();
    expect(await screen.findByText('Crie seu primeiro treino')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar treino' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/workout/templates');
  });

  it('"Usar Tabata clássico" cria o treino e abre o detalhe', async () => {
    const services = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar Tabata clássico' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    const [summary] = services.workoutsStore.getState().summaries;
    expect(summary.name).toBe('Tabata clássico');
    expect(mockRouter.push).toHaveBeenCalledWith(`/workout/${summary.id}`);
  });

  it('lista treinos com tempo total, ciclos e exercícios', async () => {
    await setup(true);
    expect(await screen.findByText('Treino de perna')).toBeTruthy();
    expect(screen.getByText('3min50s')).toBeTruthy();
    expect(screen.getByText('1 ciclo · 5 exercícios')).toBeTruthy();
  });

  it('tocar no cartão abre o detalhe', async () => {
    const services = await setup(true);
    await fireEvent.press(await screen.findByRole('button', { name: 'Abrir treino Treino de perna' }));
    const id = services.workoutsStore.getState().summaries[0].id;
    expect(mockRouter.push).toHaveBeenCalledWith(`/workout/${id}`);
  });

  it('favoritar pela estrela', async () => {
    const services = await setup(true);
    await fireEvent.press(await screen.findByRole('button', { name: 'Adicionar aos favoritos' }));
    await waitFor(() => expect(services.workoutsStore.getState().summaries[0].favorite).toBe(true));
  });

  it('menu de opções permite duplicar e excluir (com confirmação)', async () => {
    const services = await setup(true);
    const alert = jest.spyOn(Alert, 'alert');

    await fireEvent.press(await screen.findByRole('button', { name: 'Opções de Treino de perna' }));
    const options = alert.mock.calls[0][2]!;
    options.find((o) => o.text === 'Duplicar')!.onPress!();
    await waitFor(() => expect(services.workoutsStore.getState().summaries).toHaveLength(2));

    await fireEvent.press(screen.getAllByRole('button', { name: /Opções de/ })[0]);
    alert.mock.calls[1][2]!.find((o) => o.text === 'Excluir')!.onPress!();
    const confirm = alert.mock.calls[2];
    expect(confirm[0]).toBe('Excluir treino?');
    confirm[2]!.find((o) => o.text === 'Excluir')!.onPress!();
    await waitFor(() => expect(services.workoutsStore.getState().summaries).toHaveLength(1));
    alert.mockRestore();
  });
});
