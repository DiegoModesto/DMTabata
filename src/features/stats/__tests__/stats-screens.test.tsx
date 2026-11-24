import { fireEvent, screen } from '@testing-library/react-native';

import { SessionDetailScreen } from '@/features/sessions/session-detail-screen';
import { WorkoutDetailScreen } from '@/features/workouts/workout-detail-screen';
import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';
import { recordSession } from '@/test/sessionFactory';

import { StatsOverviewScreen } from '../stats-overview-screen';
import { WorkoutStatsScreen } from '../workout-stats-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

async function setupWithHistory() {
  const services = await createTestServices();
  await services.authStore.getState().signIn({ email: 'a@x.com' });
  const workout = await services.workoutsStore.getState().save(planExampleWorkout());
  const done = await recordSession(services, workout, { feedback: { rating: 5, rpe: 8 } });
  const skipped = await recordSession(services, workout, {
    skipAtMs: 10_000 + 3_000,
    feedback: { rating: 3, rpe: 6, notes: 'Pulei o polichinelo' },
  });
  return { services, workout, done, skipped };
}

describe('WorkoutStatsScreen', () => {
  beforeEach(resetRouterMock);

  it('mostra resumo, médias, exercícios pulados e histórico', async () => {
    const { services, workout } = await setupWithHistory();
    await renderWithServices(<WorkoutStatsScreen workoutId={workout.id} />, services);

    expect(await screen.findByLabelText('vezes realizado: 2')).toBeTruthy();
    expect(screen.getByLabelText('nota média: 4,0')).toBeTruthy();
    expect(screen.getByLabelText('esforço médio: 7,0')).toBeTruthy();
    expect(screen.getByText('Exercícios mais pulados')).toBeTruthy();
    expect(screen.getByText('Polichinelo')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Sessão / })).toHaveLength(2);
  });

  it('trocar o período recarrega os dados', async () => {
    const { services, workout } = await setupWithHistory();
    await renderWithServices(<WorkoutStatsScreen workoutId={workout.id} />, services);
    await screen.findByLabelText('vezes realizado: 2');
    await fireEvent.press(screen.getByRole('radio', { name: '7 dias' }));
    expect(await screen.findByLabelText('vezes realizado: 2')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '7 dias' }).props.accessibilityState.checked).toBe(true);
  });

  it('tocar numa sessão abre o detalhe', async () => {
    const { services, workout } = await setupWithHistory();
    await renderWithServices(<WorkoutStatsScreen workoutId={workout.id} />, services);
    const [first] = await screen.findAllByRole('button', { name: /^Sessão / });
    await fireEvent.press(first);
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/session\//));
  });
});

describe('SessionDetailScreen', () => {
  it('mostra tempos, avaliação e fases (com a pulada marcada)', async () => {
    const { services, skipped } = await setupWithHistory();
    await renderWithServices(<SessionDetailScreen sessionId={skipped} />, services);
    expect(await screen.findByText('“Pulei o polichinelo”')).toBeTruthy();
    expect(screen.getByText('★★★ · Esforço 6/10')).toBeTruthy();
    expect(screen.getByText('Polichinelo (pulado)')).toBeTruthy();
    expect(screen.getByText('3s / 30s')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Editar avaliação' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/session/${skipped}/feedback`);
  });
});

describe('StatsOverviewScreen', () => {
  it('sem treinos mostra estado vazio', async () => {
    const services = await createTestServices();
    await services.authStore.getState().signIn({});
    await renderWithServices(<StatsOverviewScreen />, services);
    expect(await screen.findByText('Sem estatísticas ainda')).toBeTruthy();
  });

  it('mostra totais da semana, sequência, ranking e recentes', async () => {
    const { services } = await setupWithHistory();
    await renderWithServices(<StatsOverviewScreen />, services);
    expect(await screen.findByLabelText('treinos na semana: 2')).toBeTruthy();
    expect(screen.getByLabelText('dia seguido: 1')).toBeTruthy();
    expect(screen.getByText('1. Treino de perna')).toBeTruthy();
    expect(screen.getByText('2x')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Sessão Treino de perna/ })).toHaveLength(2);
  });
});

describe('WorkoutDetailScreen — histórico', () => {
  it('resume quantas vezes foi feito e a nota média', async () => {
    const { services, workout } = await setupWithHistory();
    await renderWithServices(<WorkoutDetailScreen workoutId={workout.id} />, services);
    expect(await screen.findByText(/Realizado 2x · última vez .* · nota média 4,0/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Estatísticas' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/workout/${workout.id}/stats`);
  });
});
