import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { createFromTemplate, TEMPLATES } from '@/domain/templates';
import { workoutTotals } from '@/domain/workout';

/** Escolha do tipo de treino; o editor abre já preenchido com o modelo. */
export function TemplatePickerScreen() {
  const router = useRouter();
  return (
    <Screen title="Novo treino" scroll>
      <ThemedText themeColor="textSecondary">
        Escolha um modelo para começar. Tudo pode ser ajustado depois.
      </ThemedText>
      {TEMPLATES.map((t) => {
        const total = t.type === 'custom' ? null : workoutTotals(createFromTemplate(t.type)).totalSec;
        return (
          <Pressable
            key={t.type}
            accessibilityRole="button"
            accessibilityLabel={`Modelo ${t.name}`}
            accessibilityHint={t.description}
            onPress={() => router.replace(`/workout/new?template=${t.type}`)}>
            <Card>
              <View style={styles.header}>
                <ThemedText type="smallBold" style={styles.title}>
                  {t.name}
                </ThemedText>
                {total ? <ThemedText type="small">{formatDuration(total)}</ThemedText> : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {t.description}
              </ThemedText>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  title: { fontSize: 18 },
});
