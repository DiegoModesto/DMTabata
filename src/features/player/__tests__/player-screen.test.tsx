import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, AppState } from 'react-native';

import { createFromTemplate } from '@/domain/templates';
import { createNoopPhaseNotifier } from '@/services/notifications/phaseNotifier';

import { createSilentAlertPlayer } from '@/services/audio/alertPlayer';
import { mockRouter, resetRouterMock } from '@/test/expoRouterMock';
import { timingWorkout } from '@/test/factories';
import { createTestServices, renderWithServices } from '@/test/renderWithServices';

import { PlayerScreen } from '../player-screen';

jest.mock('expo-router', () => require('@/test/expoRouterMock'));

async function waitForSessions(
  services: Awaited<ReturnType<typeof createTestServices>>,
  expected: number,
) {
  await waitFor(async () =>
    expect(await services.db.getAllAsync('SELECT id FROM sessions')).toHaveLength(expected),
  );
}
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

  async function setup(
    customize?: (
      services: Awaited<ReturnType<typeof createTestServices>>,
      workout: ReturnType<typeof timingWorkout>,
    ) => Promise<void>,
  ) {
    jest.useFakeTimers();
    now = 0;
    const alertPlayer = createSilentAlertPlayer();
    const notifier = createNoopPhaseNotifier();
    const services = await createTestServices({ alertPlayer, clock, phaseNotifier: notifier });
    const workout = timingWorkout();
    await services.workouts.save(workout, null);
    await customize?.(services, workout);
    await renderWithServices(<PlayerScreen workoutId={workout.id} />, services);
    await screen.findByText('PREPARAR');
    const sounds = () =>
      alertPlayer.executed
        .filter((c) => c.type === 'sound')
        .map((c) => (c.type === 'sound' ? c.slot : ''));
    const soundIds = () =>
      alertPlayer.executed
        .filter((c) => c.type === 'sound')
        .map((c) => (c.type === 'sound' ? c.soundId : ''));
    return { alertPlayer, sounds, soundIds, services, workout, notifier };
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

  it('registra a sessão: em andamento durante o treino e concluída ao final', async () => {
    const { services, workout } = await setup();
    await advance(15_000);
    const open = await services.db.getAllAsync<{ status: string; actual_work_sec: number }>(
      'SELECT status, actual_work_sec FROM sessions',
    );
    expect(open).toEqual([{ status: 'in_progress', actual_work_sec: expect.any(Number) }]);

    await advance(220_000);
    await screen.findByRole('button', { name: 'Avaliar treino' });
    const [session] = await services.sessions.list({ workoutId: workout.id });
    expect(session).toMatchObject({
      status: 'completed',
      workSec: 180,
      restSec: 40,
      phasesCompleted: 10,
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Avaliar treino' }));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/session/${session.id}/feedback`);
  });

  it('parar no preparo não registra sessão nem oferece avaliação', async () => {
    const { services } = await setup();
    const alert = jest.spyOn(Alert, 'alert');
    await advance(2_000);
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    await act(async () => {
      alert.mock.calls[0][2]!.find((o) => o.text === 'Parar')!.onPress!();
    });
    await screen.findByText('Treino interrompido');
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.queryByRole('button', { name: 'Avaliar treino' })).toBeNull();
    await waitForSessions(services, 0);
    alert.mockRestore();
  });

  it('parar no meio registra sessão interrompida', async () => {
    const { services } = await setup();
    const alert = jest.spyOn(Alert, 'alert');
    await advance(50_000);
    await fireEvent.press(screen.getByRole('button', { name: 'Parar' }));
    await act(async () => {
      alert.mock.calls[0][2]!.find((o) => o.text === 'Parar')!.onPress!();
    });
    await screen.findByRole('button', { name: 'Avaliar treino' });
    const [session] = await services.sessions.list();
    expect(session).toMatchObject({ status: 'abandoned', workSec: 30 });
    alert.mockRestore();
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

  describe('segundo plano', () => {
    let listeners: ((state: string) => void)[] = [];
    beforeEach(() => {
      listeners = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
        listeners.push(listener as (state: string) => void);
        return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
      });
    });
    afterEach(() => jest.restoreAllMocks());
    const emit = async (state: string) =>
      act(async () => {
        listeners.forEach((l) => l(state));
      });

    it('ao sair do app agenda as próximas trocas de fase; ao voltar, cancela', async () => {
      const { notifier, alertPlayer } = await setup();
      expect(notifier.permissionRequests).toBe(1);
      await advance(5_000);
      await emit('background');
      expect(notifier.scheduled).toHaveLength(10);
      expect(notifier.scheduled[0]).toMatchObject({ title: 'Trabalho', body: 'Polichinelo (30s)' });

      // Em segundo plano o player não toca (as notificações cuidam disso).
      const before = alertPlayer.executed.length;
      await advance(6_000);
      expect(alertPlayer.executed.length).toBe(before);

      await emit('active');
      expect(notifier.scheduled).toEqual([]);
      expect(screen.getByText('TRABALHO')).toBeTruthy();
    });

    it('pausado não agenda notificações', async () => {
      const { notifier } = await setup();
      await fireEvent.press(screen.getByRole('button', { name: '⏸ Pausar' }));
      await emit('background');
      expect(notifier.scheduled).toEqual([]);
    });
  });

  it('bloquear esconde os controles; segurar desbloqueia', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear controles' }));
    expect(screen.queryByRole('button', { name: '⏸ Pausar' })).toBeNull();
    await fireEvent(screen.getByRole('button', { name: 'Desbloquear controles' }), 'longPress');
    expect(screen.getByRole('button', { name: '⏸ Pausar' })).toBeTruthy();
  });

  it('AMRAP: conta rounds e grava na sessão', async () => {
    jest.useFakeTimers();
    now = 0;
    const services = await createTestServices({ alertPlayer: createSilentAlertPlayer(), clock });
    const amrap = createFromTemplate('amrap');
    await services.workouts.save(amrap, null);
    await renderWithServices(<PlayerScreen workoutId={amrap.id} />, services);
    await screen.findByText('PREPARAR');
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Adicionar um round' }));
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Remover um round' }));
    expect(screen.getByLabelText('2 rounds')).toBeTruthy();
    await advance(16_000 + 12 * 60_000);
    await screen.findByRole('button', { name: 'Avaliar treino' });
    const [session] = await services.sessions.list({ workoutId: amrap.id });
    expect(session.roundsDone).toBe(2);
  });
});
