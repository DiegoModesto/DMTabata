import { DEFAULT_ALERT_SETTINGS, type AlertCommand } from '@/domain/alerts';
import { compileTimeline } from '@/domain/timeline';
import { createTabataWorkout } from '@/domain/workout';
import { planExampleWorkout } from '@/test/factories';

import { createTimerController } from '../timerController';

function simulate(timelineSource = createTabataWorkout(), until?: number) {
  const timeline = compileTimeline(timelineSource);
  const controller = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
  const commands: AlertCommand[] = [];
  let now = 0;
  commands.push(...controller.dispatch('start', now).commands);
  const end = until ?? timeline.totalMs + 1_000;
  while (now < end) {
    now += 100;
    commands.push(...controller.update(now).commands);
  }
  const sounds = commands.filter((c) => c.type === 'sound').map((c) => (c.type === 'sound' ? c.slot : ''));
  const count = (slot: string) => sounds.filter((s) => s === slot).length;
  return { controller, commands, sounds, count, timeline };
}

describe('timerController — treino completo (regra de negócio dos sons)', () => {
  it('Tabata: 8 sons de trabalho, 7 de descanso e 1 de fim', () => {
    const { count, controller } = simulate();
    expect(count('workStart')).toBe(8);
    expect(count('restStart')).toBe(7);
    expect(count('workoutEnd')).toBe(1);
    expect(controller.getState().status).toBe('finished');
  });

  it('contagem regressiva de 3 bipes antes de cada troca de fase', () => {
    const { count } = simulate();
    // preparo + 8 trabalhos + 7 descansos = 16 fases × 3 bipes
    expect(count('countdown')).toBe(16 * 3);
  });

  it('exemplo do plano: som de trabalho ao começar cada exercício', () => {
    const { count } = simulate(planExampleWorkout());
    expect(count('workStart')).toBe(5);
    expect(count('restStart')).toBe(4);
  });

  it('parar no meio não toca o som de fim', () => {
    const { controller } = simulate(createTabataWorkout(), 30_000);
    const update = controller.dispatch('stop', 30_000);
    expect(update.snapshot.status).toBe('finished');
    expect(update.commands.some((c) => c.type === 'sound')).toBe(false);
    expect(controller.getState().stoppedEarly).toBe(true);
  });

  it('pular emite o som de início da próxima fase', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
    controller.dispatch('start', 0);
    const update = controller.dispatch('skip', 2_000);
    expect(update.commands).toContainEqual(
      expect.objectContaining({ type: 'sound', slot: 'workStart' }),
    );
  });

  it('voltar para o início da mesma fase repete o som de início', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
    controller.dispatch('start', 0);
    controller.update(15_000); // 5s dentro do 1º trabalho
    const update = controller.dispatch('back', 15_000);
    expect(update.snapshot.phase?.kind).toBe('work');
    expect(update.commands).toContainEqual(
      expect.objectContaining({ type: 'sound', slot: 'workStart' }),
    );
  });

  it('configurações atualizadas valem para os próximos eventos', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
    controller.dispatch('start', 0);
    controller.setSettings({ ...DEFAULT_ALERT_SETTINGS, volume: 0, hapticsEnabled: false });
    const update = controller.dispatch('skip', 1_000);
    expect(update.commands).toEqual([]);
  });
});
