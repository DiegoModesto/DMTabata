import { timingWorkout } from '@/test/factories';

import { DEFAULT_ALERT_SETTINGS } from '../alerts';
import { notificationSound, planNotifications } from '../notificationPlan';
import { compileTimeline } from '../timeline';
import { createTabataWorkout } from '../workout';

const NOW = 1_700_000_000_000;

describe('notificationSound', () => {
  it('sons embutidos viram arquivos empacotados; importados usam o padrão do sistema', () => {
    expect(notificationSound('go')).toBe('go.wav');
    // Arquivo com "_" (exigência do Android); o id continua com hífen.
    expect(notificationSound('beep-high')).toBe('beep_high.wav');
    expect(notificationSound('ring-bell-3')).toBe('ring_bell_3.wav');
    expect(notificationSound('5f1c-uuid')).toBe('default');
    expect(notificationSound('silent')).toBeNull();
    expect(notificationSound(null)).toBeNull();
  });
});

describe('planNotifications — avisos com o app em segundo plano', () => {
  const workout = timingWorkout();
  workout.cycles[0].items[2] = { ...workout.cycles[0].items[2], workSoundId: 'gong' };
  const timeline = compileTimeline(workout);
  const plan = (elapsedMs: number, overrides = {}) =>
    planNotifications({
      timeline,
      elapsedMs,
      nowEpoch: NOW,
      settings: DEFAULT_ALERT_SETTINGS,
      workoutName: 'Treino de perna',
      ...overrides,
    });

  it('uma notificação por fase futura + fim, no horário certo', () => {
    const list = plan(5_000); // no meio do preparo
    expect(list).toHaveLength(9 + 1);
    expect(list[0]).toEqual({
      fireAt: NOW + 5_000,
      title: 'Trabalho',
      body: 'Polichinelo (30s)',
      sound: 'go.wav',
    });
    expect(list[1]).toMatchObject({
      title: 'Descanso',
      body: 'Próximo: Agachamento',
      sound: 'rest.wav',
    });
    expect(list[list.length - 1]).toEqual({
      fireAt: NOW + 225_000,
      title: 'Treino concluído!',
      body: 'Treino de perna',
      sound: 'finish.wav',
    });
  });

  it('respeita o som específico do exercício', () => {
    const prancha = plan(0).find((n) => n.body.startsWith('Prancha'));
    expect(prancha?.sound).toBe('gong.wav');
  });

  it('não agenda a fase atual nem as passadas', () => {
    const list = plan(45_000); // no descanso após o Polichinelo
    expect(list[0]).toMatchObject({ body: 'Agachamento (30s)', fireAt: NOW + 5_000 });
  });

  it('volume zero gera notificações silenciosas', () => {
    expect(
      plan(0, { settings: { ...DEFAULT_ALERT_SETTINGS, volume: 0 } }).every(
        (n) => n.sound === null,
      ),
    ).toBe(true);
  });

  it('respeita o limite e mantém o aviso de fim', () => {
    const tabata = compileTimeline({
      ...createTabataWorkout(),
      cycles: [{ ...createTabataWorkout().cycles[0], repeatCount: 50 }],
    });
    const list = planNotifications({
      timeline: tabata,
      elapsedMs: 0,
      nowEpoch: NOW,
      settings: DEFAULT_ALERT_SETTINGS,
      workoutName: 'T',
      limit: 10,
    });
    expect(list).toHaveLength(10);
    expect(list[9].title).toBe('Treino concluído!');
  });

  it('treino já terminado não agenda nada', () => {
    expect(plan(timeline.totalMs)).toEqual([]);
  });

  it('mostra a repetição em treinos com ciclo repetido', () => {
    const tabata = compileTimeline(createTabataWorkout());
    const [first] = planNotifications({
      timeline: tabata,
      elapsedMs: 0,
      nowEpoch: NOW,
      settings: DEFAULT_ALERT_SETTINGS,
      workoutName: 'T',
    });
    expect(first.body).toBe('Exercício (20s) · 1/8');
  });
});
