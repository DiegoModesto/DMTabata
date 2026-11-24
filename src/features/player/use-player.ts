import { useCallback, useEffect, useState } from 'react';

import type { AlertSettings } from '@/domain/alerts';
import { soundsInUse } from '@/domain/soundConfig';
import type { Timeline } from '@/domain/timeline';
import {
  createTimerController,
  type ControllerUpdate,
  type TimerAction,
} from '@/engine/timerController';
import type { AlertPlayer } from '@/services/audio/alertPlayer';

/** Intervalo de renderização. Não é fonte da verdade do tempo (ver timerEngine). */
export const TICK_MS = 100;

export function usePlayer(
  timeline: Timeline,
  settings: AlertSettings,
  deps: { alertPlayer: AlertPlayer; clock: () => number },
) {
  const { alertPlayer, clock } = deps;
  // Controlador criado uma única vez por montagem (timeline fixa durante o treino).
  const [controller] = useState(() => createTimerController(timeline, settings));

  const [snapshot, setSnapshot] = useState(() => controller.update(clock()).snapshot);
  const [stoppedEarly, setStoppedEarly] = useState(false);

  const apply = useCallback(
    (update: ControllerUpdate) => {
      if (update.commands.length) alertPlayer.execute(update.commands);
      setStoppedEarly(controller.getState().stoppedEarly);
      setSnapshot(update.snapshot);
    },
    [alertPlayer, controller],
  );

  useEffect(() => {
    controller.setSettings(settings);
  }, [controller, settings]);

  useEffect(() => {
    const overrides = timeline.phases.map((p) => p.soundOverride);
    void alertPlayer.prepare(soundsInUse(settings, overrides), { duckMusic: settings.duckMusic });
  }, [alertPlayer, settings, timeline]);

  useEffect(() => () => alertPlayer.release(), [alertPlayer]);

  useEffect(() => {
    const handle = setInterval(() => apply(controller.update(clock())), TICK_MS);
    return () => clearInterval(handle);
  }, [apply, controller, clock]);

  const dispatch = useCallback(
    (action: TimerAction) => apply(controller.dispatch(action, clock())),
    [apply, controller, clock],
  );

  const getLog = useCallback(() => controller.getLog(), [controller]);

  return { snapshot, dispatch, stoppedEarly, getLog };
}
