import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { workoutTotals } from '@/domain/workout';
import {
  mockNavigation,
  mockRouter,
  preventRemoveState,
  resetRouterMock,
} from '@/test/expoRouterMock';
import { Alert } from 'react-native';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { WorkoutEditorScreen } from '../workout-editor-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

async function pressTimes(name: string | RegExp, times: number, index = 0) {
  for (let i = 0; i < times; i++) {
    await fireEvent.press(screen.getAllByRole('button', { name })[index]);
  }
}

describe('WorkoutEditorScreen — novo treino', () => {
  beforeEach(resetRouterMock);

  it('cenário do plano: 5 exercícios de 30s/10s e o 3º com 60s', async () => {
    const services = await createTestServices();
    await services.authStore.getState().signIn({});
    await renderWithServices(<WorkoutEditorScreen />, services);

    await fireEvent.changeText(screen.getByLabelText('Nome do treino'), 'Treino de perna');
    // Padrão do novo ciclo já é 5 × 30s/10s
    expect(screen.getByLabelText('Exercícios: 5')).toBeTruthy();
    expect(screen.getByLabelText('Trabalho padrão: 0:30')).toBeTruthy();
    expect(screen.getByLabelText('Descanso padrão: 0:10')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Editar Exercício 3' }));
    await fireEvent.changeText(screen.getByLabelText('Nome do exercício'), 'Prancha');
    await pressTimes('Aumentar Trabalho', 6); // 30 → 60
    expect(screen.getByLabelText('Trabalho: 1:00')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));

    // 16s preparo + 220s do ciclo
    expect(screen.getByLabelText('Tempo total 3min56s')).toBeTruthy();
    expect(screen.getByText('Tempo do ciclo: 3min40s')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());

    const [summary] = services.workoutsStore.getState().summaries;
    const saved = await services.workouts.getById(summary.id);
    expect(saved!.name).toBe('Treino de perna');
    expect(saved!.cycles[0].items[2]).toMatchObject({
      label: 'Prancha',
      workSec: 60,
      restSec: null,
    });
    expect(workoutTotals(saved!).cycleDurationsSec).toEqual([220]);
    expect(mockRouter.replace).toHaveBeenCalledWith(`/workout/${saved!.id}`);
  });

  it('não salva sem nome e mostra o erro', async () => {
    const services = await createTestServices();
    await renderWithServices(<WorkoutEditorScreen />, services);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('• Dê um nome ao treino.')).toBeTruthy();
    expect(await services.workouts.listSummaries(null)).toEqual([]);
  });

  it('adiciona ciclo e exibe descanso entre ciclos', async () => {
    await renderWithServices(<WorkoutEditorScreen />);
    expect(screen.queryByLabelText(/Descanso entre ciclos:/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '+ Ciclo' }));
    expect(screen.getByLabelText('Nome do ciclo 2')).toBeTruthy();
    expect(screen.getByLabelText('Descanso entre ciclos: 1:00')).toBeTruthy();
  });

  it('mudar a quantidade de exercícios altera a lista', async () => {
    await renderWithServices(<WorkoutEditorScreen />);
    await pressTimes('Aumentar Exercícios', 2);
    expect(screen.getByRole('button', { name: 'Editar Exercício 7' })).toBeTruthy();
    await pressTimes('Diminuir Exercícios', 4);
    expect(screen.queryByRole('button', { name: 'Editar Exercício 4' })).toBeNull();
  });

  it('"Voltar ao padrão do ciclo" desfaz a sobrescrita', async () => {
    await renderWithServices(<WorkoutEditorScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Editar Exercício 1' }));
    await pressTimes('Aumentar Descanso', 2);
    expect(screen.getByLabelText('Descanso: 0:20')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao padrão do ciclo' }));
    expect(screen.getByLabelText('Descanso: 0:10')).toBeTruthy();
  });
});

describe('WorkoutEditorScreen — sons por exercício', () => {
  beforeEach(resetRouterMock);

  it('escolhe um som de início do trabalho só para o 3º exercício', async () => {
    const services = await createTestServices();
    const saved = await services.workoutsStore.getState().save(planExampleWorkout());
    await renderWithServices(<WorkoutEditorScreen workoutId={saved.id} />, services);

    await fireEvent.press(await screen.findByRole('button', { name: 'Editar Prancha' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Início do trabalho: Som do treino (padrão)' }),
    );
    await fireEvent.press(await screen.findByRole('radio', { name: 'Gongo' }));
    expect(screen.getByRole('button', { name: 'Início do trabalho: Gongo' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const items = (await services.workouts.getById(saved.id))!.cycles[0].items;
    expect(items[2].workSoundId).toBe('gong');
    expect(items.filter((i) => i.workSoundId !== null)).toHaveLength(1);
  });
});

describe('WorkoutEditorScreen — modelos e alterações não salvas', () => {
  beforeEach(resetRouterMock);

  it('abre preenchido com o modelo escolhido (HIIT)', async () => {
    await renderWithServices(<WorkoutEditorScreen template="hiit" />);
    expect(screen.getByLabelText('Nome do treino').props.value).toBe('HIIT');
    expect(screen.getByLabelText('Repetir ciclo: 10x')).toBeTruthy();
    expect(screen.getByLabelText('Trabalho padrão: 0:40')).toBeTruthy();
  });

  it('sem alterações, sair não pede confirmação', async () => {
    await renderWithServices(<WorkoutEditorScreen />);
    expect(preventRemoveState.prevent).toBe(false);
  });

  it('com alterações, sair pede confirmação e só descarta se o usuário confirmar', async () => {
    await renderWithServices(<WorkoutEditorScreen />);
    await fireEvent.changeText(screen.getByLabelText('Nome do treino'), 'Rascunho');
    expect(preventRemoveState.prevent).toBe(true);

    const alert = jest.spyOn(Alert, 'alert');
    const action = { type: 'GO_BACK' };
    preventRemoveState.callback!({ data: { action } });
    expect(alert.mock.calls[0][0]).toBe('Descartar alterações?');
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    alert.mock.calls[0][2]!.find((o) => o.text === 'Descartar')!.onPress!();
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(action);
    alert.mockRestore();
  });

  it('depois de salvar, sai sem pedir confirmação', async () => {
    const services = await createTestServices();
    await renderWithServices(<WorkoutEditorScreen />, services);
    await fireEvent.changeText(screen.getByLabelText('Nome do treino'), 'Novo');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(preventRemoveState.prevent).toBe(false);
  });
});

describe('WorkoutEditorScreen — editar', () => {
  beforeEach(resetRouterMock);

  it('carrega o treino existente, altera e salva voltando', async () => {
    const services = await createTestServices();
    await services.authStore.getState().signIn({});
    const saved = await services.workoutsStore.getState().save(planExampleWorkout());
    await renderWithServices(<WorkoutEditorScreen workoutId={saved.id} />, services);

    const prancha = await screen.findByRole('button', { name: 'Editar Prancha' });
    expect(within(prancha).getByText('✎ 60s / 10s')).toBeTruthy();

    await pressTimes('Aumentar Repetir ciclo', 1);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await services.workouts.getById(saved.id))!.cycles[0].repeatCount).toBe(2);
  });
});
