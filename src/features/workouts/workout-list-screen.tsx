import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { showAlert } from '@/components/ui/app-dialog';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';
import { useServices, useWorkouts } from '@/providers/services-provider';
import type { WorkoutSummary } from '@/services/db/repositories/workoutRepository';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function WorkoutCard({
  workout,
  onOpen,
  onMenu,
  onToggleFavorite,
}: {
  workout: WorkoutSummary;
  onOpen: () => void;
  onMenu: () => void;
  onToggleFavorite: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir treino ${workout.name}`}
      accessibilityHint="Toque e segure para mais opções"
      onPress={onOpen}
      onLongPress={onMenu}>
      <Card>
        <View style={styles.cardHeader}>
          <ThemedText type="smallBold" style={styles.cardTitle} numberOfLines={1}>
            {workout.name}
          </ThemedText>
          <IconButton
            glyph={workout.favorite ? '★' : '☆'}
            label={workout.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            onPress={onToggleFavorite}
            color={workout.favorite ? theme.primary : theme.textSecondary}
          />
          <IconButton glyph="⋯" label={`Opções de ${workout.name}`} onPress={onMenu} />
        </View>
        <ThemedText type="subtitle">{formatDuration(workout.totalSec)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {plural(workout.cycleCount, 'ciclo', 'ciclos')} ·{' '}
          {plural(workout.exerciseCount, 'exercício', 'exercícios')}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

export function WorkoutListScreen() {
  const router = useRouter();
  const { workoutsStore } = useServices();
  const summaries = useWorkouts((s) => s.summaries);
  const loaded = useWorkouts((s) => s.loaded);

  useFocusEffect(
    useCallback(() => {
      void workoutsStore.getState().load();
    }, [workoutsStore]),
  );

  const openMenu = (workout: WorkoutSummary) => {
    const { duplicate, toggleFavorite, remove } = workoutsStore.getState();
    showAlert(workout.name, undefined, [
      {
        text: workout.favorite ? 'Remover dos favoritos' : 'Favoritar',
        onPress: () => void toggleFavorite(workout.id),
      },
      { text: 'Duplicar', onPress: () => void duplicate(workout.id) },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          showAlert('Excluir treino?', `"${workout.name}" será removido.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: () => void remove(workout.id) },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const createTabata = async () => {
    const workout = await workoutsStore.getState().createTabata();
    router.push(`/workout/${workout.id}`);
  };

  return (
    <Screen
      title="Treinos"
      headerRight={
        <Button
          title="+ Novo"
          onPress={() => router.push('/workout/templates')}
          style={styles.newBtn}
        />
      }>
      {loaded && summaries.length === 0 ? (
        <EmptyState
          title="Crie seu primeiro treino"
          message="Monte ciclos com o tempo de cada exercício e descanso."
          action={
            <View style={styles.emptyActions}>
              <Button title="Criar treino" onPress={() => router.push('/workout/templates')} />
              <Button title="Usar Tabata clássico" variant="secondary" onPress={createTabata} />
            </View>
          }
        />
      ) : (
        <FlatList
          data={summaries}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <WorkoutCard
              workout={item}
              onOpen={() => router.push(`/workout/${item.id}`)}
              onMenu={() => openMenu(item)}
              onToggleFavorite={() => void workoutsStore.getState().toggleFavorite(item.id)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three, paddingBottom: Spacing.six },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  cardTitle: { flex: 1, fontSize: 18 },
  newBtn: { minHeight: 40, paddingHorizontal: Spacing.three },
  emptyActions: { gap: Spacing.two, alignSelf: 'stretch' },
});
