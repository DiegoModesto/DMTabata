import { createNoopPhaseNotifier, type PhaseNotifier } from './phaseNotifier';

/**
 * Na web não há notificações locais agendadas (sem servidor de push):
 * os avisos de fase acontecem só com o app aberto, pelo som.
 */
export function createExpoPhaseNotifier(): PhaseNotifier {
  return createNoopPhaseNotifier();
}
