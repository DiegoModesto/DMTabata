import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { describeStartupError } from '@/domain/startupError';

/** Tela mostrada quando o banco local não abre (ex.: app já aberto em outra aba). */
export function StartupErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const problem = describeStartupError(error);
  return (
    <Screen>
      <View style={styles.center}>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.text}>
          {problem.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          {problem.message}
        </ThemedText>
        {problem.canRetry ? <Button title="Tentar de novo" onPress={onRetry} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  text: { textAlign: 'center' },
});
