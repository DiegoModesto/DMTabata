import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatTile } from '@/components/ui/stat-tile';
import { PhaseColors, Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { addDays, dayKey, startOfDay } from '@/domain/stats';
import { useTheme } from '@/hooks/use-theme';
import { useAuth, useServices } from '@/providers/services-provider';
import type { SessionService } from '@/services/sessions/sessionService';

import { formatDate } from './format';
import { SessionList } from './session-list';

type Overview = Awaited<ReturnType<SessionService['overview']>>;

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Calendário das últimas 5 semanas (segunda a domingo) marcando dias treinados. */
function TrainingCalendar({ days, now }: { days: Set<string>; now: number }) {
  const theme = useTheme();
  const today = startOfDay(now);
  const offset = (new Date(today).getDay() + 6) % 7;
  const first = addDays(today, -offset - 28);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(first, i));
  return (
    <View style={styles.calendar} accessibilityLabel="Calendário de treinos">
      {WEEKDAYS.map((d, i) => (
        <ThemedText key={`h${i}`} type="small" themeColor="textSecondary" style={styles.cell}>
          {d}
        </ThemedText>
      ))}
      {cells.map((ts) => {
        const trained = days.has(dayKey(ts));
        const future = ts > today;
        return (
          <View
            key={ts}
            style={styles.cell}
            accessible
            accessibilityLabel={`${formatDate(ts)}${trained ? ', treinou' : ''}`}>
            <View
              style={[
                styles.day,
                {
                  backgroundColor: trained ? PhaseColors.work : theme.backgroundElement,
                  opacity: future ? 0.3 : 1,
                  borderWidth: ts === today ? 2 : 0,
                  borderColor: theme.text,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

export function StatsOverviewScreen() {
  const { sessionService } = useServices();
  const userId = useAuth((s) => s.user?.id ?? null);
  const [data, setData] = useState<{ overview: Overview; now: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      sessionService.overview(userId).then((overview) => {
        if (active) setData({ overview, now: Date.now() });
      });
      return () => {
        active = false;
      };
    }, [sessionService, userId]),
  );

  if (!data) return <Screen title="Estatísticas">{null}</Screen>;
  const { overview, now } = data;

  if (overview.recent.length === 0) {
    return (
      <Screen title="Estatísticas">
        <EmptyState
          title="Sem estatísticas ainda"
          message="Conclua um treino para ver seu progresso aqui."
        />
      </Screen>
    );
  }

  return (
    <Screen title="Estatísticas" scroll>
      <View style={styles.tiles}>
        <StatTile label="treinos na semana" value={String(overview.week.sessions)} />
        <StatTile label="tempo na semana" value={formatDuration(overview.week.totalSec)} />
        <StatTile label="treinos no mês" value={String(overview.month.sessions)} />
        <StatTile
          label={overview.streak === 1 ? 'dia seguido' : 'dias seguidos'}
          value={String(overview.streak)}
        />
      </View>

      <Card>
        <ThemedText type="smallBold">Dias treinados</ThemedText>
        <TrainingCalendar days={overview.trainedDays} now={now} />
      </Card>

      <Card>
        <BarChart
          title="Treinos por semana"
          color={PhaseColors.rest}
          bars={overview.weekly.map((w) => ({
            key: String(w.weekStart),
            value: w.count,
            label: formatDate(w.weekStart),
            valueLabel: `${w.count} treino(s)`,
          }))}
        />
      </Card>

      {overview.topWorkouts.length ? (
        <Card>
          <ThemedText type="smallBold">Mais realizados no mês</ThemedText>
          {overview.topWorkouts.map((w, i) => (
            <View key={`${w.workoutId}-${w.name}`} style={styles.row}>
              <ThemedText type="small" style={styles.flex}>
                {i + 1}. {w.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {w.count}x
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <ThemedText type="smallBold">Recentes</ThemedText>
        <SessionList sessions={overview.recent} showWorkoutName />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3, textAlign: 'center' },
  day: { width: 26, height: 26, borderRadius: 6 },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
