import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TimelineBar } from '@/components/timeline-bar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { PhaseColors, Spacing } from '@/constants/theme';
import { formatClock, formatDuration } from '@/domain/format';
import { compileTimeline } from '@/domain/timeline';
import {
  effectiveRestSec,
  effectiveWorkSec,
  isItemOverridden,
  restAfterItem,
  workoutTotals,
  type Workout,
} from '@/domain/workout';
import { useTheme } from '@/hooks/use-theme';
import { formatAverage, formatDate } from '@/features/stats/format';
import type { StatsSummary } from '@/domain/stats';
import { useServices } from '@/providers/services-provider';

export function WorkoutDetailScreen({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const { workouts, workoutsStore, sessionService } = useServices();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [history, setHistory] = useState<StatsSummary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        workouts.getById(workoutId),
        sessionService.workoutStats(workoutId, 'all'),
      ]).then(([w, stats]) => {
        if (!active) return;
        setWorkout(w);
        setNotFound(!w);
        setHistory(stats.summary);
      });
      return () => {
        active = false;
      };
    }, [workoutId, workouts, sessionService]),
  );

  const totals = useMemo(() => (workout ? workoutTotals(workout) : null), [workout]);
  const timeline = useMemo(() => (workout ? compileTimeline(workout) : null), [workout]);

  if (notFound) {
    return (
      <Screen title="Treino">
        <ThemedText>Treino não encontrado.</ThemedText>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!workout || !totals || !timeline) return <Screen title="Treino">{null}</Screen>;

  const confirmDelete = () =>
    Alert.alert('Excluir treino?', `"${workout.name}" será removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await workoutsStore.getState().remove(workout.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen title={workout.name} scroll>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Tempo total
        </ThemedText>
        <ThemedText
          type="title"
          accessibilityLabel={`Tempo total ${formatDuration(totals.totalSec)}`}
          style={styles.total}>
          {formatClock(totals.totalSec)}
        </ThemedText>
        <View style={styles.legend}>
          <ThemedText type="small" style={{ color: PhaseColors.work }}>
            ● Trabalho {formatDuration(totals.workSec)}
          </ThemedText>
          <ThemedText type="small" style={{ color: PhaseColors.rest }}>
            ● Descanso {formatDuration(totals.restSec + totals.cycleRestSec)}
          </ThemedText>
        </View>
        <TimelineBar timeline={timeline} />
      </Card>

      <Button
        title="▶ Começar"
        onPress={() => router.push(`/player/${workout.id}`)}
        disabled={timeline.phases.length === 0}
        style={styles.start}
      />

      <Card>
        <ThemedText type="smallBold">Histórico</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {history && history.sessions > 0
            ? `Realizado ${history.sessions}x · última vez ${formatDate(history.lastSessionAt!)} · nota média ${formatAverage(history.avgRating)}`
            : 'Você ainda não fez este treino.'}
        </ThemedText>
        <Button
          title="Estatísticas"
          variant="secondary"
          onPress={() => router.push(`/workout/${workout.id}/stats`)}
        />
      </Card>

      <ThemedText type="smallBold">Ciclos</ThemedText>
      {workout.cycles.map((cycle, c) => {
        const open = expanded[cycle.id] ?? workout.cycles.length === 1;
        return (
          <Card key={cycle.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${cycle.name}, ${formatDuration(totals.cycleDurationsSec[c])}`}
              onPress={() => setExpanded((e) => ({ ...e, [cycle.id]: !open }))}
              style={styles.cycleHeader}>
              <View style={styles.flex}>
                <ThemedText type="smallBold">{cycle.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {cycle.items.length} exercícios
                  {cycle.repeatCount > 1 ? ` · ${cycle.repeatCount}x` : ''}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{formatDuration(totals.cycleDurationsSec[c])}</ThemedText>
              <ThemedText type="small">{open ? '▾' : '▸'}</ThemedText>
            </Pressable>
            {open
              ? cycle.items.map((item, i) => {
                  const rest = restAfterItem(cycle, i, cycle.repeatCount - 1);
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <ThemedText type="small" style={styles.flex}>
                        {i + 1}. {item.label}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={isItemOverridden(item) ? { color: theme.primary } : undefined}>
                        {effectiveWorkSec(cycle, item)}s
                        {rest > 0 ? ` / ${effectiveRestSec(cycle, item)}s` : ''}
                      </ThemedText>
                    </View>
                  );
                })
              : null}
            {c < workout.cycles.length - 1 && workout.restBetweenCyclesSec > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Depois: {formatDuration(workout.restBetweenCyclesSec)} de descanso entre ciclos
              </ThemedText>
            ) : null}
          </Card>
        );
      })}

      <View style={styles.actions}>
        <Button
          title="Editar"
          variant="secondary"
          style={styles.flex}
          onPress={() => router.push(`/workout/${workout.id}/edit`)}
        />
        <Button
          title="Sons"
          variant="secondary"
          style={styles.flex}
          onPress={() => router.push(`/workout/${workout.id}/sounds`)}
        />
      </View>
      <View style={styles.actions}>
        <Button title="Excluir" variant="ghost" style={styles.flex} onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
  start: { minHeight: 56 },
  cycleHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
