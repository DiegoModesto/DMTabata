import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { PhaseColors, Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { completionRate, sessionDurationSec, type SessionRecord } from '@/domain/stats';
import type { PhaseKind } from '@/domain/timeline';
import { useServices } from '@/providers/services-provider';
import type { SessionPhaseRecord } from '@/services/db/repositories/sessionRepository';

import { feedbackLine, formatDateTime, formatPercent, statusLabel } from '../stats/format';

const KIND_LABELS: Record<string, string> = {
  prepare: 'Preparo',
  work: 'Trabalho',
  rest: 'Descanso',
  cycleRest: 'Descanso entre ciclos',
  cooldown: 'Desaquecimento',
};

export function SessionDetailScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { sessionService } = useServices();
  const [session, setSession] = useState<SessionRecord | null | undefined>(undefined);
  const [phases, setPhases] = useState<SessionPhaseRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        sessionService.getSession(sessionId),
        sessionService.sessionPhases(sessionId),
      ]).then(([s, p]) => {
        if (!active) return;
        setSession(s);
        setPhases(p);
      });
      return () => {
        active = false;
      };
    }, [sessionId, sessionService]),
  );

  if (session === undefined) return <Screen title="Sessão">{null}</Screen>;
  if (session === null) return <Screen title="Sessão não encontrada">{null}</Screen>;

  return (
    <Screen title={session.workoutName} scroll>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDateTime(session.startedAt)} · {statusLabel(session)}
        </ThemedText>
        <ThemedText type="subtitle">{formatDuration(sessionDurationSec(session))}</ThemedText>
        <ThemedText type="small">
          de {formatDuration(session.plannedSec)} planejados · {formatPercent(completionRate(session))}{' '}
          concluído
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Trabalho {formatDuration(session.workSec)} · Descanso {formatDuration(session.restSec)}
          {session.pausedSec ? ` · Pausa ${formatDuration(session.pausedSec)}` : ''}
        </ThemedText>
        {session.roundsDone !== null ? (
          <ThemedText type="smallBold">{session.roundsDone} rounds</ThemedText>
        ) : null}
      </Card>

      <Card>
        <ThemedText type="smallBold">Avaliação</ThemedText>
        <ThemedText type="small">{feedbackLine(session) ?? 'Sem avaliação.'}</ThemedText>
        {session.feedback?.notes ? (
          <ThemedText type="small" themeColor="textSecondary">
            “{session.feedback.notes}”
          </ThemedText>
        ) : null}
        <Button
          title={session.feedback ? 'Editar avaliação' : 'Avaliar'}
          variant="secondary"
          onPress={() => router.push(`/session/${session.id}/feedback`)}
        />
      </Card>

      {phases.length ? (
        <Card>
          <ThemedText type="smallBold">Fases</ThemedText>
          {phases.map((p) => (
            <View key={p.phaseIndex} style={styles.phase}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: PhaseColors[p.kind as PhaseKind] ?? PhaseColors.finished },
                ]}
              />
              <ThemedText type="small" style={styles.flex}>
                {p.exerciseLabel ?? KIND_LABELS[p.kind] ?? p.kind}
                {p.skipped && p.actualMs < p.plannedMs - 250 ? ' (pulado)' : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDuration(p.actualMs / 1000)} / {formatDuration(p.plannedMs / 1000)}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  phase: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
});
