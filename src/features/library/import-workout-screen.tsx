import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { cycleDurationSec, workoutTotals, type Workout } from '@/domain/workout';
import { useServices } from '@/providers/services-provider';

type State =
  | { status: 'loading' }
  | { status: 'error'; reason: string }
  | { status: 'ready'; text: string; workout: Workout; hasSounds: boolean; missingSounds: number };

/** Treino recebido de outro app: mostra o que é e adiciona aos meus treinos. */
export function ImportWorkoutScreen({ uri }: { uri: string }) {
  const router = useRouter();
  const { library, workoutsStore } = useServices();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const text = await library.readUri(uri);
        const parsed = await library.preview(text);
        if (!active) return;
        setState(
          parsed.ok
            ? {
                status: 'ready',
                text,
                workout: parsed.workout,
                hasSounds: parsed.sounds !== null,
                missingSounds: parsed.missingSounds,
              }
            : { status: 'error', reason: parsed.reason },
        );
      } catch {
        if (active) setState({ status: 'error', reason: 'Não foi possível abrir o arquivo.' });
      }
    })();
    return () => {
      active = false;
    };
  }, [library, uri]);

  const add = async () => {
    if (state.status !== 'ready') return;
    setSaving(true);
    const result = await library.importText(state.text);
    setSaving(false);
    if (result.status !== 'imported') {
      setState({ status: 'error', reason: result.status === 'error' ? result.reason : '' });
      return;
    }
    await workoutsStore.getState().load();
    router.replace(`/workout/${result.workout.id}`);
  };

  const close = () => router.replace('/');

  if (state.status === 'loading') return <Screen title="Importar treino">{null}</Screen>;
  if (state.status === 'error') {
    return (
      <Screen title="Importar treino">
        <ThemedText>{state.reason}</ThemedText>
        <Button title="Fechar" variant="secondary" onPress={close} />
      </Screen>
    );
  }

  const { workout } = state;
  const totals = workoutTotals(workout);
  return (
    <Screen title="Importar treino" scroll>
      <Card>
        <ThemedText type="subtitle" accessibilityRole="header">
          {workout.name}
        </ThemedText>
        <ThemedText accessibilityLabel={`Tempo total ${formatDuration(totals.totalSec)}`}>
          Tempo total {formatDuration(totals.totalSec)} · preparação {workout.prepareSec}s
        </ThemedText>
        {workout.cycles.map((c) => (
          <View key={c.id} style={styles.row}>
            <ThemedText type="small" style={styles.flex}>
              {c.name}
              {c.repeatCount > 1 ? ` ×${c.repeatCount}` : ''} · {c.items.length} exercícios
            </ThemedText>
            <ThemedText type="small">{formatDuration(cycleDurationSec(c))}</ThemedText>
          </View>
        ))}
        {state.hasSounds ? (
          <ThemedText type="small" themeColor="textSecondary">
            Vem com os sons configurados pelo autor.
          </ThemedText>
        ) : null}
        {state.missingSounds > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {state.missingSounds} som(ns) não existem neste aparelho e vão usar o padrão.
          </ThemedText>
        ) : null}
      </Card>
      <Button title="Adicionar aos meus treinos" loading={saving} onPress={() => void add()} />
      <Button title="Cancelar" variant="ghost" onPress={close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  flex: { flex: 1 },
});
