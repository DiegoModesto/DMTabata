import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Número de destaque com rótulo (ex.: "12 · treinos"). */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView
      type="backgroundElement"
      style={styles.tile}
      accessible
      accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="subtitle" style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: 16, padding: Spacing.three, gap: Spacing.half },
  value: { fontSize: 26, lineHeight: 32 },
});
