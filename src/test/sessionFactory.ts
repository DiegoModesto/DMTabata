import { DEFAULT_ALERT_SETTINGS } from '@/domain/alerts';
import type { Feedback } from '@/domain/stats';
import { compileTimeline } from '@/domain/timeline';
import type { Workout } from '@/domain/workout';
import { createTimerController } from '@/engine/timerController';
import type { Services } from '@/services/container';

/** Executa (simulado) um treino e grava a sessão, opcionalmente com feedback. */
export async function recordSession(
  services: Services,
  workout: Workout,
  options: { stopAtMs?: number; skipAtMs?: number; feedback?: Partial<Feedback> } = {},
): Promise<string> {
  const timeline = compileTimeline(workout);
  const controller = createTimerController(timeline, DEFAULT_ALERT_SETTINGS);
  controller.dispatch('start', 0);
  const end = options.stopAtMs ?? timeline.totalMs + 200;
  for (let t = 100; t <= end; t += 100) {
    if (t === options.skipAtMs) controller.dispatch('skip', t);
    else controller.update(t);
  }
  if (options.stopAtMs) controller.dispatch('stop', end);
  const id = await services.sessionService.start(workout, timeline);
  await services.sessionService.finish(id, controller.getLog(), !!options.stopAtMs);
  if (options.feedback) {
    await services.sessionService.saveFeedback(id, {
      rating: null,
      rpe: null,
      difficulty: null,
      mood: null,
      notes: null,
      ...options.feedback,
    });
  }
  return id;
}
