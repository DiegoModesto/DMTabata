import { StyleSheet, View } from 'react-native';

import { PhaseColors } from '@/constants/theme';
import type { Timeline } from '@/domain/timeline';

/** Barra proporcional com a cor de cada fase (verde = trabalho, azul = descanso...). */
export function TimelineBar({ timeline, height = 12 }: { timeline: Timeline; height?: number }) {
  if (timeline.totalMs === 0) return null;
  return (
    <View
      style={[styles.bar, { height, borderRadius: height / 2 }]}
      accessibilityLabel="Linha do tempo do treino"
      accessible>
      {timeline.phases.map((phase) => (
        <View
          key={phase.index}
          style={{ flex: phase.durationMs, backgroundColor: PhaseColors[phase.kind] }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', overflow: 'hidden', width: '100%', gap: 1 },
});
