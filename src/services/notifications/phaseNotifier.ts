import type { PlannedNotification } from '@/domain/notificationPlan';

/** Agenda avisos de troca de fase para quando o app está em segundo plano. */
export interface PhaseNotifier {
  ensurePermission(): Promise<boolean>;
  schedule(notifications: PlannedNotification[]): Promise<void>;
  cancelAll(): Promise<void>;
}

export function createNoopPhaseNotifier() {
  const state = { scheduled: [] as PlannedNotification[], cancels: 0, permissionRequests: 0 };
  const notifier: PhaseNotifier & typeof state = Object.assign(state, {
    async ensurePermission() {
      state.permissionRequests++;
      return true;
    },
    async schedule(list: PlannedNotification[]) {
      state.scheduled = [...list];
    },
    async cancelAll() {
      state.cancels++;
      state.scheduled = [];
    },
  });
  return notifier;
}
