import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { AlertSettings } from '@/domain/alerts';
import { planNotifications } from '@/domain/notificationPlan';
import type { Timeline } from '@/domain/timeline';
import type { TimerSnapshot } from '@/engine/timerEngine';
import type { PhaseNotifier } from '@/services/notifications/phaseNotifier';

/** Só consideramos segundo plano estados explícitos (o inicial pode ser 'unknown'). */
const isActive = (state: AppStateStatus | string | null | undefined) =>
  state !== 'background' && state !== 'inactive';

/** Ref que indica se o app está em primeiro plano (para o player tocar os alertas). */
export function useForegroundRef() {
  const ref = useRef(isActive(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      ref.current = isActive(state);
    });
    return () => sub.remove();
  }, []);
  return ref;
}

/**
 * Em segundo plano o JS pode ser suspenso: ao sair do app agendamos notificações
 * locais para cada troca de fase; ao voltar, cancelamos e o player reassume
 * (o motor recalcula o estado pelo relógio, sem perder tempo).
 */
export function useBackgroundNotifications(params: {
  notifier: PhaseNotifier;
  timeline: Timeline;
  settings: AlertSettings;
  workoutName: string;
  peek: () => TimerSnapshot;
  now?: () => number;
}) {
  const { notifier, timeline, settings, workoutName, peek, now = Date.now } = params;

  useEffect(() => {
    void notifier.ensurePermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (isActive(state)) {
        void notifier.cancelAll();
        return;
      }
      const snapshot = peek();
      if (snapshot.status !== 'running') return;
      void notifier.schedule(
        planNotifications({
          timeline,
          elapsedMs: snapshot.elapsedMs,
          nowEpoch: now(),
          settings,
          workoutName,
        }),
      );
    });
    return () => {
      sub.remove();
      void notifier.cancelAll();
    };
  }, [notifier, timeline, settings, workoutName, peek, now]);
}
