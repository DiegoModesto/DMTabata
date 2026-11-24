import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { completionRate, sessionDurationSec, type SessionRecord } from '@/domain/stats';

import { feedbackLine, formatDateTime, formatPercent, statusLabel } from './format';

export function SessionList({
  sessions,
  showWorkoutName = false,
}: {
  sessions: SessionRecord[];
  showWorkoutName?: boolean;
}) {
  const router = useRouter();
  if (sessions.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Nenhum treino no período.
      </ThemedText>
    );
  }
  return (
    <View style={styles.list}>
      {sessions.map((s) => {
        const title = showWorkoutName ? s.workoutName : formatDateTime(s.startedAt);
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`Sessão ${title}, ${statusLabel(s)}`}
            onPress={() => router.push(`/session/${s.id}`)}
            style={styles.row}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">{title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {showWorkoutName ? `${formatDateTime(s.startedAt)} · ` : ''}
                {formatDuration(sessionDurationSec(s))} · {formatPercent(completionRate(s))} ·{' '}
                {statusLabel(s)}
              </ThemedText>
              {feedbackLine(s) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {feedbackLine(s)}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText type="small">›</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  flex: { flex: 1 },
});
