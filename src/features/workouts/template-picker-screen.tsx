import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showAlert } from '@/components/ui/app-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { createFromTemplate, TEMPLATES } from '@/domain/templates';
import { workoutTotals } from '@/domain/workout';
import { useTheme } from '@/hooks/use-theme';
import { useServices } from '@/providers/services-provider';
import type { LibraryTemplate } from '@/services/library/workoutLibrary';

function TemplateCard({
  label,
  title,
  subtitle,
  duration,
  onPress,
  onRemove,
}: {
  label: string;
  title: string;
  subtitle: string;
  duration: number | null;
  onPress: () => void;
  onRemove?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <Card>
        <View style={styles.header}>
          <ThemedText type="smallBold" style={styles.title}>
            {title}
          </ThemedText>
          {duration ? <ThemedText type="small">{formatDuration(duration)}</ThemedText> : null}
          {onRemove ? (
            <IconButton
              glyph="✕"
              label={`Remover modelo ${title}`}
              color={theme.danger}
              onPress={onRemove}
            />
          ) : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const describe = (t: LibraryTemplate) =>
  `${t.cycleCount} ${t.cycleCount === 1 ? 'ciclo' : 'ciclos'} · ${t.exerciseCount} exercícios`;

/** Escolha de modelo: tipos básicos, modelos do DMTabata, meus modelos ou importar arquivo. */
export function TemplatePickerScreen() {
  const router = useRouter();
  const { library, workoutsStore } = useServices();
  const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    library.templates().then((list) => active && setTemplates(list));
    return () => {
      active = false;
    };
  }, [library, version]);

  const open = async (workoutId: string) => {
    await workoutsStore.getState().load();
    router.replace(`/workout/${workoutId}`);
  };

  const startFromTemplate = async (t: LibraryTemplate) => {
    const workout = await library.createFromTemplate(t.id);
    await open(workout.id);
  };

  const removeTemplate = (t: LibraryTemplate) =>
    showAlert('Remover modelo?', `"${t.name}" sai de Meus modelos. Seus treinos não mudam.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await library.removeTemplate(t.id);
          reload();
        },
      },
    ]);

  const importFile = async () => {
    const result = await library.importFromPicker();
    if (result.status === 'error') showAlert('Não foi possível importar', result.reason);
    if (result.status === 'imported') await open(result.workout.id);
  };

  const bundled = templates.filter((t) => t.source === 'bundled');
  const mine = templates.filter((t) => t.source === 'user');

  return (
    <Screen title="Novo treino" scroll>
      <ThemedText themeColor="textSecondary">
        Escolha um modelo para começar. Tudo pode ser ajustado depois.
      </ThemedText>

      {bundled.length ? (
        <ThemedText type="smallBold" accessibilityRole="header" style={styles.section}>
          Modelos do DMTabata
        </ThemedText>
      ) : null}
      {bundled.map((t) => (
        <TemplateCard
          key={t.id}
          label={`Modelo ${t.name}`}
          title={t.name}
          subtitle={describe(t)}
          duration={t.totalSec}
          onPress={() => void startFromTemplate(t)}
        />
      ))}

      {mine.length ? (
        <ThemedText type="smallBold" accessibilityRole="header" style={styles.section}>
          Meus modelos
        </ThemedText>
      ) : null}
      {mine.map((t) => (
        <TemplateCard
          key={t.id}
          label={`Modelo ${t.name}`}
          title={t.name}
          subtitle={describe(t)}
          duration={t.totalSec}
          onPress={() => void startFromTemplate(t)}
          onRemove={() => removeTemplate(t)}
        />
      ))}

      <ThemedText type="smallBold" accessibilityRole="header" style={styles.section}>
        Modelos básicos
      </ThemedText>
      {TEMPLATES.map((t) => {
        const total =
          t.type === 'custom' ? null : workoutTotals(createFromTemplate(t.type)).totalSec;
        return (
          <TemplateCard
            key={t.type}
            label={`Modelo ${t.name}`}
            title={t.name}
            subtitle={t.description}
            duration={total}
            onPress={() => router.replace(`/workout/new?template=${t.type}`)}
          />
        );
      })}

      <Button
        title="Importar treino de arquivo"
        icon="share"
        variant="secondary"
        onPress={() => void importFile()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: { fontSize: 18, flex: 1 },
  section: { marginTop: Spacing.two },
});
