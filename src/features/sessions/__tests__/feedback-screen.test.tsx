import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { timingWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';
import { recordSession } from '@/test/sessionFactory';

import { FeedbackScreen } from '../feedback-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

async function setup() {
  const services = await createTestServices();
  const workout = timingWorkout();
  await services.workouts.save(workout, null);
  const sessionId = await recordSession(services, workout, { stopAtMs: 50_000 });
  await renderWithServices(<FeedbackScreen sessionId={sessionId} />, services);
  return { services, workout, sessionId };
}

describe('FeedbackScreen — resumo e avaliação pós-treino', () => {
  beforeEach(resetRouterMock);

  it('mostra o resumo do que foi feito', async () => {
    await setup();
    expect(await screen.findByText('Treino de perna')).toBeTruthy();
    expect(screen.getByText(/Interrompido · 30% concluído/)).toBeTruthy();
    expect(screen.getByText(/Tempo realizado 40s de 3min50s/)).toBeTruthy();
  });

  it('salva nota, esforço, dificuldade, humor e observações e abre as estatísticas', async () => {
    const { services, workout, sessionId } = await setup();
    await fireEvent.press(await screen.findByRole('radio', { name: '4 ★' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Aumentar Esforço percebido (1–10)' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Difícil' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Cansado' }));
    await fireEvent.changeText(screen.getByLabelText('Observações'), 'Reduzir a prancha');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(`/workout/${workout.id}/stats`),
    );
    expect((await services.sessionService.getSession(sessionId))?.feedback).toEqual({
      rating: 4,
      rpe: 6,
      difficulty: 'dificil',
      mood: 'cansado',
      notes: 'Reduzir a prancha',
    });
  });

  it('tocar de novo na opção desmarca', async () => {
    await setup();
    const option = await screen.findByRole('radio', { name: 'Ideal' });
    await fireEvent.press(option);
    expect(screen.getByRole('radio', { name: 'Ideal' }).props.accessibilityState.checked).toBe(
      true,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Ideal' }));
    expect(screen.getByRole('radio', { name: 'Ideal' }).props.accessibilityState.checked).toBe(
      false,
    );
  });

  it('"Pular" segue sem salvar avaliação', async () => {
    const { services, sessionId, workout } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Pular' }));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/workout/${workout.id}/stats`);
    expect((await services.sessionService.getSession(sessionId))?.feedback).toBeNull();
  });
});
