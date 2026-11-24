import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import boxe from '@/assets/workouts/boxe-sequenciado.json';
import { buildWorkoutFile, serializeWorkoutFile } from '@/domain/workoutFile';
import { createFakeBackupIO } from '@/test/fakeBackupIO';
import { planExampleWorkout } from '@/test/factories';

import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { TemplatePickerScreen } from '../template-picker-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

describe('TemplatePickerScreen', () => {
  beforeEach(resetRouterMock);

  it('lista os modelos com duração e abre o editor com o escolhido', async () => {
    await renderWithServices(<TemplatePickerScreen />);
    expect(screen.getByRole('button', { name: 'Modelo Tabata' })).toBeTruthy();
    expect(screen.getByText('4min06s')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Modelo Personalizado' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Modelo Circuito' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/workout/new?template=circuit');
  });
});

describe('TemplatePickerScreen — modelos do DMTabata, meus modelos e importar', () => {
  beforeEach(resetRouterMock);
  afterEach(() => jest.restoreAllMocks());

  async function setup() {
    const fake = createFakeBackupIO();
    const services = await createTestServices({
      backupIO: fake.io,
      bundledWorkouts: [{ id: 'boxe-sequenciado', file: boxe }],
    });
    await services.authStore.getState().signIn({ email: 'ana@x.com' });
    return { services, fake };
  }

  it('mostra o Boxe Sequenciado e cria uma cópia dele ao tocar', async () => {
    const { services } = await setup();
    await renderWithServices(<TemplatePickerScreen />, services);
    expect(await screen.findByRole('header', { name: 'Modelos do DMTabata' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Modelo Boxe Sequenciado' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const target = mockRouter.replace.mock.calls[0][0] as string;
    const created = await services.workouts.getById(target.replace('/workout/', ''));
    expect(created?.name).toBe('Boxe Sequenciado');
  });

  it('lista "Meus modelos" e permite remover', async () => {
    const { services } = await setup();
    const w = await services.workouts.save(planExampleWorkout({ name: 'Perna' }), null);
    await services.library.saveAsTemplate(w.id);
    const alert = jest.spyOn(Alert, 'alert');
    await renderWithServices(<TemplatePickerScreen />, services);
    expect(await screen.findByRole('header', { name: 'Meus modelos' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remover modelo Perna' }));
    await act(async () => {
      await alert.mock.calls[0][2]!.find((o) => o.text === 'Remover')!.onPress!();
    });
    await waitFor(() => expect(screen.queryByRole('header', { name: 'Meus modelos' })).toBeNull());
  });

  it('"Importar treino de arquivo" adiciona o treino e abre o detalhe', async () => {
    const { services, fake } = await setup();
    fake.state.nextPick = serializeWorkoutFile(
      buildWorkoutFile(planExampleWorkout({ name: 'Do amigo' }), null, () => true).file,
    );
    await renderWithServices(<TemplatePickerScreen />, services);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Importar treino de arquivo' }),
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const names = services.workoutsStore.getState().summaries.map((s) => s.name);
    expect(names).toContain('Do amigo');
  });
});
