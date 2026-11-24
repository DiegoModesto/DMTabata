import { DEFAULT_ALERT_SETTINGS } from '@/domain/alerts';
import { createTimerController } from '@/engine/timerController';
import { planExampleWorkout } from '@/test/factories';

import { summarizeSession } from '../sessionRecorder';
import { compileTimeline } from '../timeline';

const timeline = compileTimeline(planExampleWorkout()); // 10s preparo + 220s

type Action = Parameters<ReturnType<typeof createTimerController>['dispatch']>[0];

/** Roteiro com relógio simulado: `tick` avança com passos irregulares; `c.dispatch` age no instante dado (e move o relógio). */
function run(
  script: (c: { dispatch: (a: Action, at: number) => void }, tick: (until: number, step?: number) => void) => void,
) {
  const controller = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
  let now = 0;
  const tick = (until: number, step = 137) => {
    while (now < until) {
      now = Math.min(until, now + step);
      controller.update(now);
    }
  };
  const dispatch = (action: Action, at: number) => {
    tick(at);
    now = at;
    controller.dispatch(action, at);
  };
  controller.dispatch('start', 0);
  script({ dispatch }, tick);
  return { log: controller.getLog(), summary: summarizeSession(controller.getLog()) };
}

describe('sessionRecorder — tempo realizado por fase', () => {
  it('treino completo: cada fase com o tempo planejado exato (sem erro de tick)', () => {
    const { log, summary } = run((_, tick) => tick(timeline.totalMs + 2_000));
    log.phases.forEach((p) => expect(p.actualMs).toBe(p.plannedMs));
    expect(summary).toMatchObject({
      phasesCompleted: timeline.phases.length,
      phasesSkipped: 0,
      completionRate: 1,
      workMs: 180_000,
      restMs: 40_000,
      pausedMs: 0,
    });
  });

  it('pausa não conta como tempo de treino, mas é registrada', () => {
    const { log, summary } = run((c, tick) => {
      tick(5_000);
      c.dispatch('pause', 5_000);
      tick(65_000);
      c.dispatch('resume', 65_000);
      tick(66_000);
    });
    expect(log.phases[0].actualMs).toBe(6_000);
    expect(summary.pausedMs).toBe(60_000);
  });

  it('pular registra o tempo parcial e marca a fase como pulada', () => {
    const { log, summary } = run((c, tick) => {
      tick(10_000 + 12_000); // 12s no Polichinelo
      c.dispatch('skip', 22_000);
      tick(30_000);
    });
    expect(log.phases[1]).toMatchObject({ label: 'Polichinelo', actualMs: 12_000, skipped: true });
    expect(log.phases[2].actualMs).toBe(8_000);
    expect(summary.phasesSkipped).toBe(1);
    expect(summary.skippedExercises).toEqual(['Polichinelo']);
  });

  it('voltar e refazer: fase repetida acumula o tempo das duas vezes', () => {
    const { log } = run((c, tick) => {
      tick(20_000); // 10s no Polichinelo
      c.dispatch('back', 20_000); // reinicia o Polichinelo
      tick(50_000); // faz os 30s completos
    });
    expect(log.phases[1].actualMs).toBe(40_000);
  });

  it('parar no meio: fases não alcançadas ficam zeradas', () => {
    const { log, summary } = run((c, tick) => {
      tick(45_000);
      c.dispatch('stop', 45_000);
    });
    expect(log.phases[1].actualMs).toBe(30_000);
    expect(log.phases[2].actualMs).toBe(5_000);
    expect(log.phases.slice(3).every((p) => p.actualMs === 0)).toBe(true);
    expect(summary.phasesCompleted).toBe(2);
    expect(summary.completionRate).toBeCloseTo(2 / timeline.phases.length);
  });

  it('pular pausado mantém o registro correto', () => {
    const { log } = run((c, tick) => {
      tick(3_000);
      c.dispatch('pause', 3_000);
      c.dispatch('skip', 4_000);
      c.dispatch('resume', 10_000);
      tick(15_000);
    });
    expect(log.phases[0]).toMatchObject({ actualMs: 3_000, skipped: true });
    expect(log.phases[1].actualMs).toBe(5_000);
  });

  it('pular uma fase já quase concluída não conta como pulada', () => {
    const { summary } = run((c, tick) => {
      tick(9_900);
      c.dispatch('skip', 9_900);
    });
    expect(summary.phasesSkipped).toBe(0);
  });
});
