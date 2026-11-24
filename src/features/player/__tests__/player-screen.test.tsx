import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createSilentAlertPlayer } from '@/services/audio/alertPlayer';
import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { planExampleWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { PlayerScreen } from '../player-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

describe('PlayerScreen — temporizador com sons', () => {
  let now = 0;
  const clock = () => now;

  async function advance(ms: number) {
    const step = 100;
    for (let t = 0; t < ms; t += step) {
      now += step;
      await act(async () => {
        jest.advanceTimersByTime(step);
      });
    }
  }

  async function setup(customize?: (services: Awaited<ReturnType<typeof createTestServices>>, workout: ReturnType<typeof planExampleWorkout>) => Promise<void>) {
    jest.useFakeTimers();
    now = 0;
    const alertPlayer = createSilentAlertPlayer();
    const services = await createTestServices({ alertPlayer, clock });
    const workout = planExampleWorkout();
    await services.workouts.save(workout, null);
    await customize?.(services, workout);
    await renderWithServices(<PlayerScreen workoutId={workout.id} />, services);
    await screen.findByText('PREPARAR');
    const sounds = () =>
      alertPlayer.executed.filter((c) => c.type === 'sound').map((c) => (c.type === 'sound' ? c.slot : ''));
    const soundIds = () =>
      alertPlayer.executed.filter((c) => c.type === 'sound').map((c) => (c.type === 'sound' ? c.soundId : ''));
    return { alertPlayer, sounds, soundIds };
  }

  beforeEach(resetRouterMock);
  afterEach(() => jest.useRealTimers());

  it('começa pela preparação e entra no primeiro exercício com som de trabalho', async () => {
    const { sounds } = await setup();
    expect(screen.getByText('0:10')).toBeTruthy();
    expect(screen.getByText('Próximo: Polichinelo')).toBeTruthy();

    await advance(10_000);
    expect(screen.getByText('TRABALHO')).toBeTruthy();
    expect(screen.getByText('Polichinelo')).toBeTruthy();
    expect(screen.getByText('0:30')).toBeTruthy();
    expect(sounds()).toEqual(['countdown', 'countdown', 'countdown', 'workStart']);
  });

  it('toca o som de descanso ao começar o descanso', async () => {
    const { sounds } = await setup();
    await advance(40_000);
    expect(screen.getByText('DESCANSO')).toBeTruthy();
    expect(sounds()).toContain('restStart');
    expect(screen.getByText('Próximo: Agachamento')).toBeTruthy();
  });

  it('pausar congela o relógio e continuar retoma', async () => {
    await setup();
    await advance(2_000);
    await fireEvent.press(screen.getByRole('button', { name: '⏸ Pausar' }));
    expect(screen.getByText('PAUSADO')).toBeTruthy();
    await advance(5_000);
    expect(screen.getByText('0:08')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '▶ Continuar' }));
    await advance(1_000);
    expect(screen.getByText('0:07')).toBeTruthy();
  });

  it('pular vai direto ao exercício e mostra o 3º com 60s', async () => {
    await setup();
    for (let i = 0; i < 5; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Pular ⏭' }));
    }
    expect(screen.getByText('Prancha')).toBeTruthy();
    expect(screen.getByText('1:00')).toBeTruthy();
    expect(screen.getByText(/Exercício 3\/5/)).toBeTruthy();
  });

  it('ao terminar mostra o resumo e toca o som de fim', async () => {
    const { sounds } = await setup();
    await advance(230_000);
    expect(screen.getByText('Treino concluído!')).toBeTruthy();
    expect(sounds().filter((s) => s === 'workStart')).toHaveLength(5);
    expect(sounds().filter((s) => s === 'workoutEnd')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('usa os sons configurados: treino, exercício e pré-carregamento', async () => {
    const { soundIds, alertPlayer } = await setup(async (services, workout) => {
      const own = await services.soundService.personalizeWorkout(workout.id);
      await services.soundService.saveConfig({
        ...own,
        sounds: { ...own.sounds, workStart: 'whistle', countdown: 'silent' },
        duckMusic: false,
      });
      workout.cycles[0].items[1] = { ...workout.cycles[0].items[1], workSoundId: 'gong' };
      await services.workouts.save({ ...workout, soundConfigId: own.id }, null);
    });
    await advance(10_000 + 40_000 + 100);
    expect(soundIds()).toEqual(['whistle', 'rest', 'gong']);
    expect(alertPlayer.prepared).toEqual(expect.arrayContaining(['whistle', 'gong', 'rest']));
    expect(alertPlayer.prepared).not.toContain('silent');
    expect(alertPlayer.options).toEqual({ duckMusic: false });
  });

  it('narração por voz quando habilitada', async () => {
    const { alertPlayer } = await setup(async (services) => {
      const global = await services.soundService.globalConfig();
      await services.soundService.saveConfig({ ...global, voiceEnabled: true });
    });
    await advance(10_000);
    const speech = alertPlayer.executed.filter((c) => c.type === 'speak');
    expect(speech).toEqual([
      { type: 'speak', text: 'Prepare-se. Próximo: Polichinelo.', lang: 'pt-BR' },
      { type: 'speak', text: 'Vai! Polichinelo.', lang: 'pt-BR' },
    ]);
  });

  it('parar pede confirmação e encerra como interrompido', async () => {
    await setup();
    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    await act(async () => {
      alert.mock.calls[0][2]!.find((o) => o.text === 'Parar')!.onPress!();
    });
    expect(screen.getByText('Treino interrompido')).toBeTruthy();
    alert.mockRestore();
  });
});
