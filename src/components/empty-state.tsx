import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = { title: string; message?: string; action?: ReactNode };

export function EmptyState({ title, message, action }: Props) {
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" style={styles.text}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          {message}
        </ThemedText>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  text: { textAlign: 'center' },
});
