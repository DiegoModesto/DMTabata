import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chips } from '@/components/ui/chips';
import { Screen } from '@/components/ui/screen';
import { StatTile } from '@/components/ui/stat-tile';
import { PhaseColors, Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { PERIOD_LABELS, sessionDurationSec, type Period } from '@/domain/stats';
import { useServices } from '@/providers/services-provider';
import type { SessionService } from '@/services/sessions/sessionService';

import { formatAverage, formatDate, formatPercent } from './format';
import { SessionList } from './session-list';

type Stats = Awaited<ReturnType<SessionService['workoutStats']>>;

const PERIODS = (Object.keys(PERIOD_LABELS) as Period[]).map((value) => ({
  value,
  label: PERIOD_LABELS[value],
}));

export function WorkoutStatsScreen({ workoutId }: { workoutId: string }) {
  const { sessionService, workouts } = useServices();
  const [period, setPeriod] = useState<Period>('30d');
  const [stats, setStats] = useState<Stats | null>(null);
  const [name, setName] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        sessionService.workoutStats(workoutId, period),
        workouts.getById(workoutId),
      ]).then(([s, w]) => {
        if (!active) return;
        setStats(s);
        setName(w?.name ?? 'Treino');
      });
      return () => {
        active = false;
      };
    }, [workoutId, period, sessionService, workouts]),
  );

  if (!stats) return <Screen title="Estatísticas">{null}</Screen>;
  const { summary } = stats;
  const chronological = [...stats.sessions].reverse().slice(-12);

  return (
    <Screen title={`Estatísticas · ${name}`} scroll>
      <Chips label="Período" options={PERIODS} value={period} onChange={(p) => p && setPeriod(p)} />

      <View style={styles.tiles}>
        <StatTile label="vezes realizado" value={String(summary.sessions)} />
        <StatTile label="tempo total" value={formatDuration(summary.totalSec)} />
        <StatTile label="conclusão média" value={formatPercent(summary.avgCompletion)} />
        <StatTile label="nota média" value={formatAverage(summary.avgRating)} />
        <StatTile label="esforço médio" value={formatAverage(summary.avgRpe)} />
        <StatTile
          label="última vez"
          value={summary.lastSessionAt ? formatDate(summary.lastSessionAt) : '—'}
        />
      </View>

      <Card>
        <BarChart
          title="Duração por sessão"
          color={PhaseColors.work}
          bars={chronological.map((s) => ({
            key: s.id,
            value: sessionDurationSec(s),
            label: formatDate(s.startedAt),
            valueLabel: formatDuration(sessionDurationSec(s)),
          }))}
        />
      </Card>

      <Card>
        <BarChart
          title="Esforço percebido por sessão"
          color={PhaseColors.prepare}
          max={10}
          bars={chronological
            .filter((s) => s.feedback?.rpe)
            .map((s) => ({
              key: s.id,
              value: s.feedback!.rpe!,
              label: formatDate(s.startedAt),
              valueLabel: `${s.feedback!.rpe}/10`,
            }))}
        />
      </Card>

      <Card>
        <BarChart
          title="Frequência semanal"
          color={PhaseColors.rest}
          bars={stats.weekly.map((w) => ({
            key: String(w.weekStart),
            value: w.count,
            label: formatDate(w.weekStart),
            valueLabel: `${w.count} treino(s)`,
          }))}
        />
      </Card>

      {stats.mostSkipped.length ? (
        <Card>
          <ThemedText type="smallBold">Exercícios mais pulados</ThemedText>
          {stats.mostSkipped.map((s) => (
            <View key={s.label} style={styles.row}>
              <ThemedText type="small" style={styles.flex}>
                {s.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {s.count}x
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <ThemedText type="smallBold">Histórico</ThemedText>
        <SessionList sessions={stats.sessions} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
