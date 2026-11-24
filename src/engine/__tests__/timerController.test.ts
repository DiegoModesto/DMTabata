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
  const sounds = commands
    .filter((c) => c.type === 'sound')
    .map((c) => (c.type === 'sound' ? c.slot : ''));
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
    controller.update(21_000); // 5s dentro do 1º trabalho
    const update = controller.dispatch('back', 21_000);
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

describe('timerController — sons surpresa', () => {
  const settings = {
    ...DEFAULT_ALERT_SETTINGS,
    surpriseSounds: ['chicote', 'risada', 'seiya'],
    surpriseChance: 1,
  };

  function run(controller: ReturnType<typeof createTimerController>, until: number) {
    const commands: AlertCommand[] = [];
    commands.push(...controller.dispatch('start', 0).commands);
    for (let t = 100; t <= until; t += 100) commands.push(...controller.update(t).commands);
    return commands;
  }

  it('toca no canal surpresa cada som sorteado, no momento sorteado', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, settings, () => 0.5);
    const commands = run(controller, timeline.totalMs + 1_000);
    const played = commands.filter((c) => c.type === 'sound' && c.slot === 'surprise');
    expect(played).toHaveLength(controller.getSurprises().length);
    expect(played.every((c) => c.type === 'sound' && c.channel === 'surprise')).toBe(true);
  });

  it('ao terminar, silencia a surpresa antes do som de fim', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, settings, () => 0.5);
    const commands = run(controller, timeline.totalMs + 1_000);
    const stopIndex = commands.findIndex((c) => c.type === 'stopChannel');
    const endIndex = commands.findIndex((c) => c.type === 'sound' && c.slot === 'workoutEnd');
    expect(stopIndex).toBeGreaterThanOrEqual(0);
    expect(stopIndex).toBeLessThan(endIndex);
  });

  it('pausar e parar silenciam a surpresa', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, settings, () => 0.5);
    run(controller, 20_000);
    expect(controller.dispatch('pause', 20_000).commands).toContainEqual({
      type: 'stopChannel',
      channel: 'surprise',
    });
    controller.dispatch('resume', 21_000);
    expect(controller.dispatch('stop', 22_000).commands).toContainEqual({
      type: 'stopChannel',
      channel: 'surprise',
    });
  });

  it('volume zero não toca surpresas; sem lista não sorteia', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const silent = createTimerController(timeline, { ...settings, volume: 0 }, () => 0.5);
    expect(
      run(silent, timeline.totalMs).some((c) => c.type === 'sound' && c.slot === 'surprise'),
    ).toBe(false);
    expect(createTimerController(timeline, DEFAULT_ALERT_SETTINGS).getSurprises()).toEqual([]);
  });

  it('mudar a lista durante o treino refaz o sorteio', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, DEFAULT_ALERT_SETTINGS, () => 0.5);
    expect(controller.getSurprises()).toEqual([]);
    controller.setSettings(settings);
    expect(controller.getSurprises().length).toBeGreaterThan(0);
  });
});

describe('timerController — música de fundo', () => {
  const settings = { ...DEFAULT_ALERT_SETTINGS, backgroundMusicId: 'vibes', musicVolume: 0.4 };
  const music = (commands: AlertCommand[]) =>
    commands.filter((c) => c.type === 'music').map((c) => (c.type === 'music' ? c.action : ''));

  it('começa em loop ao iniciar, com volume abaixo dos alertas, antes do som da preparação', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, { ...settings, volume: 0.5 });
    const { commands } = controller.dispatch('start', 0);
    expect(commands[0]).toEqual({ type: 'music', action: 'start', soundId: 'vibes', volume: 0.2 });
  });

  it('pausa, retoma e para junto com o treino', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, settings);
    controller.dispatch('start', 0);
    expect(music(controller.dispatch('pause', 5_000).commands)).toEqual(['pause']);
    expect(music(controller.dispatch('resume', 6_000).commands)).toEqual(['resume']);
    expect(music(controller.dispatch('stop', 7_000).commands)).toEqual(['stop']);
  });

  it('ao terminar o treino, a música para antes do som de fim', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, settings);
    controller.dispatch('start', 0);
    const { commands } = controller.update(timeline.totalMs + 100);
    const stopAt = commands.findIndex((c) => c.type === 'music' && c.action === 'stop');
    const endAt = commands.findIndex((c) => c.type === 'sound' && c.slot === 'workoutEnd');
    expect(stopAt).toBeGreaterThanOrEqual(0);
    expect(stopAt).toBeLessThan(endAt);
  });

  it('pular e voltar não mexem na música; sem música não há comandos', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, settings);
    controller.dispatch('start', 0);
    expect(music(controller.dispatch('skip', 2_000).commands)).toEqual([]);
    expect(music(controller.dispatch('back', 3_000).commands)).toEqual([]);
    const plain = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
    expect(music(plain.dispatch('start', 0).commands)).toEqual([]);
  });

  it('volume zero não inicia a música', () => {
    const timeline = compileTimeline(createTabataWorkout());
    const controller = createTimerController(timeline, { ...settings, volume: 0 });
    expect(music(controller.dispatch('start', 0).commands)).toEqual([]);
  });
});
