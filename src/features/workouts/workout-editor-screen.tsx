import { useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import { soundName, type SoundEntry } from '@/domain/sounds';
import { validateWorkout } from '@/domain/validation';
import { createFromTemplate } from '@/domain/templates';
import {
  cycleDurationSec,
  effectiveRestSec,
  effectiveWorkSec,
  isItemOverridden,
  LIMITS,
  restAfterItem,
  workoutTotals,
  type Cycle,
  type Workout,
  type WorkoutType,
} from '@/domain/workout';
import { editorReducer, type EditorAction } from '@/domain/workoutEditor';
import { SoundPickerModal } from '@/features/sounds/sound-picker-modal';
import { useSoundLibrary } from '@/features/sounds/use-sound-library';
import { useTheme } from '@/hooks/use-theme';
import { useServices } from '@/providers/services-provider';

import { ItemEditorModal } from './item-editor-modal';

function CycleCard({
  cycle,
  index,
  total,
  dispatch,
  onEditItem,
  onPickSound,
  library,
}: {
  cycle: Cycle;
  index: number;
  total: number;
  dispatch: (action: EditorAction) => void;
  onEditItem: (itemId: string) => void;
  onPickSound: (itemId: string) => void;
  library: SoundEntry[];
}) {
  const theme = useTheme();
  const updateCycle = (changes: Extract<EditorAction, { type: 'updateCycle' }>['changes']) =>
    dispatch({ type: 'updateCycle', cycleId: cycle.id, changes });

  return (
    <Card>
      <TextField
        label={`Nome do ciclo ${index + 1}`}
        value={cycle.name}
        onChangeText={(name) => updateCycle({ name })}
        maxLength={LIMITS.nameMaxLength}
      />
      <View style={styles.cycleActions}>
        <IconButton
          glyph="↑"
          label={`Mover ${cycle.name} para cima`}
          disabled={index === 0}
          onPress={() => dispatch({ type: 'moveCycle', cycleId: cycle.id, direction: -1 })}
        />
        <IconButton
          glyph="↓"
          label={`Mover ${cycle.name} para baixo`}
          disabled={index === total - 1}
          onPress={() => dispatch({ type: 'moveCycle', cycleId: cycle.id, direction: 1 })}
        />
        <IconButton
          glyph="⧉"
          label={`Duplicar ${cycle.name}`}
          disabled={total >= LIMITS.maxCycles}
          onPress={() => dispatch({ type: 'duplicateCycle', cycleId: cycle.id })}
        />
        <IconButton
          glyph="✕"
          label={`Remover ${cycle.name}`}
          disabled={total <= 1}
          color={theme.danger}
          onPress={() => dispatch({ type: 'removeCycle', cycleId: cycle.id })}
        />
      </View>

      <Stepper
        label="Exercícios"
        format="count"
        step={1}
        min={1}
        max={LIMITS.maxItemsPerCycle}
        value={cycle.items.length}
        onChange={(count) => dispatch({ type: 'setItemCount', cycleId: cycle.id, count })}
      />
      <Stepper
        label="Trabalho padrão"
        min={LIMITS.minWorkSec}
        value={cycle.defaultWorkSec}
        onChange={(defaultWorkSec) => updateCycle({ defaultWorkSec })}
      />
      <Stepper
        label="Descanso padrão"
        value={cycle.defaultRestSec}
        onChange={(defaultRestSec) => updateCycle({ defaultRestSec })}
      />
      <Stepper
        label="Repetir ciclo"
        format="count"
        suffix="x"
        step={1}
        min={LIMITS.minRepeat}
        max={LIMITS.maxRepeat}
        value={cycle.repeatCount}
        onChange={(repeatCount) => updateCycle({ repeatCount })}
      />
      <View style={styles.rowBetween}>
        <ThemedText type="small">Pular descanso do último exercício</ThemedText>
        <Switch
          accessibilityLabel="Pular descanso do último exercício"
          value={cycle.skipLastRest}
          onValueChange={(skipLastRest) => updateCycle({ skipLastRest })}
        />
      </View>

      <View style={styles.items}>
        {cycle.items.map((item, i) => {
          const rest = restAfterItem(cycle, i, cycle.repeatCount - 1);
          const overridden = isItemOverridden(item);
          const name = item.label || `exercício ${i + 1}`;
          const ownSound = item.workSoundId ? soundName(item.workSoundId, library) : null;
          return (
            <ThemedView key={item.id} type="background" style={styles.itemRow}>
              <Pressable
                style={styles.itemMain}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${name}`}
                onPress={() => onEditItem(item.id)}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.itemIndex}>
                  {i + 1}
                </ThemedText>
                <View style={styles.itemLabel}>
                  <ThemedText type="small" numberOfLines={1}>
                    {item.label || '—'}
                  </ThemedText>
                  {ownSound ? (
                    <ThemedText
                      type="small"
                      numberOfLines={1}
                      style={[styles.itemSound, { color: theme.primary }]}>
                      ♪ {ownSound}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText
                  type="smallBold"
                  style={overridden ? { color: theme.primary } : undefined}>
                  {overridden ? '✎ ' : ''}
                  {effectiveWorkSec(cycle, item)}s /{' '}
                  {rest > 0 ? `${effectiveRestSec(cycle, item)}s` : '—'}
                </ThemedText>
              </Pressable>
              <IconButton
                icon="sound"
                label={`Som de ${name}`}
                color={ownSound ? theme.primary : theme.textSecondary}
                onPress={() => onPickSound(item.id)}
              />
              <IconButton
                glyph="↑"
                label={`Mover ${item.label} para cima`}
                disabled={i === 0}
                onPress={() =>
                  dispatch({ type: 'moveItem', cycleId: cycle.id, itemId: item.id, direction: -1 })
                }
              />
              <IconButton
                glyph="↓"
                label={`Mover ${item.label} para baixo`}
                disabled={i === cycle.items.length - 1}
                onPress={() =>
                  dispatch({ type: 'moveItem', cycleId: cycle.id, itemId: item.id, direction: 1 })
                }
              />
            </ThemedView>
          );
        })}
      </View>
      <Button
        title="+ Exercício"
        variant="secondary"
        disabled={cycle.items.length >= LIMITS.maxItemsPerCycle}
        onPress={() => dispatch({ type: 'addItem', cycleId: cycle.id })}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Tempo do ciclo: {formatDuration(cycleDurationSec(cycle))}
      </ThemedText>
    </Card>
  );
}

type Props = { workoutId?: string; template?: WorkoutType };

export function WorkoutEditorScreen({ workoutId, template = 'custom' }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const { workouts, workoutsStore } = useServices();
  const [initial] = useState<Workout | null>(() =>
    workoutId ? null : createFromTemplate(template),
  );
  const [draft, setDraft] = useState<Workout | null>(initial);
  const [originalJson, setOriginalJson] = useState<string | null>(
    initial ? JSON.stringify(initial) : null,
  );
  const [editing, setEditing] = useState<{ cycleId: string; itemId: string } | null>(null);
  const [pickingSound, setPickingSound] = useState<{ cycleId: string; itemId: string } | null>(
    null,
  );
  const { library, reload: reloadLibrary } = useSoundLibrary();
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const allowLeave = useRef(false);

  useEffect(() => {
    if (!workoutId) return;
    let active = true;
    workouts.getById(workoutId).then((w) => {
      if (!active) return;
      if (w) {
        setOriginalJson(JSON.stringify(w));
        setDraft(w);
      } else {
        allowLeave.current = true;
        router.back();
      }
    });
    return () => {
      active = false;
    };
  }, [workoutId, workouts, router]);

  const dirty = useMemo(
    () => draft !== null && originalJson !== null && JSON.stringify(draft) !== originalJson,
    [draft, originalJson],
  );

  // Qualquer saída (botão, gesto, voltar do Android) com alterações pede confirmação.
  usePreventRemove(dirty, ({ data }) => {
    if (allowLeave.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert('Descartar alterações?', 'As mudanças não salvas serão perdidas.', [
      { text: 'Continuar editando', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const dispatch = (action: EditorAction) => {
    setDraft((current) => (current ? editorReducer(current, action) : current));
    setErrors([]);
  };

  const totals = useMemo(() => (draft ? workoutTotals(draft) : null), [draft]);

  if (!draft || !totals) {
    return <Screen title={workoutId ? 'Editar treino' : 'Novo treino'}>{null}</Screen>;
  }

  const editingCycle = editing ? draft.cycles.find((c) => c.id === editing.cycleId) : undefined;
  const editingItem = editingCycle?.items.find((i) => i.id === editing?.itemId) ?? null;
  const soundItem = pickingSound
    ? draft.cycles
        .find((c) => c.id === pickingSound.cycleId)
        ?.items.find((i) => i.id === pickingSound.itemId)
    : undefined;

  const save = async () => {
    const problems = validateWorkout(draft);
    if (problems.length) {
      setErrors(problems.map((p) => p.message));
      return;
    }
    setSaving(true);
    try {
      const saved = await workoutsStore.getState().save(draft);
      allowLeave.current = true;
      setDraft(saved);
      setOriginalJson(JSON.stringify(saved));
      if (workoutId) router.back();
      else router.replace(`/workout/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => router.back();

  return (
    <Screen
      title={workoutId ? 'Editar treino' : 'Novo treino'}
      scroll
      headerRight={<Button title="Cancelar" variant="ghost" onPress={cancel} />}>
      <TextField
        label="Nome do treino"
        placeholder="Ex.: Treino de perna"
        value={draft.name}
        onChangeText={(name) => dispatch({ type: 'setName', name })}
        maxLength={LIMITS.nameMaxLength}
      />
      <Card>
        <Stepper
          label="Preparação"
          min={LIMITS.minPrepareSec}
          max={LIMITS.maxPrepareSec}
          value={draft.prepareSec}
          onChange={(seconds) => dispatch({ type: 'setPrepare', seconds })}
        />
        {draft.cycles.length > 1 ? (
          <Stepper
            label="Descanso entre ciclos"
            value={draft.restBetweenCyclesSec}
            onChange={(seconds) => dispatch({ type: 'setRestBetweenCycles', seconds })}
          />
        ) : null}
        <Stepper
          label="Desaquecimento"
          value={draft.cooldownSec}
          onChange={(seconds) => dispatch({ type: 'setCooldown', seconds })}
        />
      </Card>

      {draft.cycles.map((cycle, index) => (
        <CycleCard
          key={cycle.id}
          cycle={cycle}
          index={index}
          total={draft.cycles.length}
          dispatch={dispatch}
          onEditItem={(itemId) => setEditing({ cycleId: cycle.id, itemId })}
          onPickSound={(itemId) => setPickingSound({ cycleId: cycle.id, itemId })}
          library={library}
        />
      ))}
      <Button
        title="+ Ciclo"
        variant="secondary"
        disabled={draft.cycles.length >= LIMITS.maxCycles}
        onPress={() => dispatch({ type: 'addCycle' })}
      />

      {errors.length ? (
        <View accessibilityLiveRegion="polite" style={styles.errors}>
          {errors.map((message) => (
            <ThemedText key={message} type="small" themeColor="danger">
              • {message}
            </ThemedText>
          ))}
        </View>
      ) : null}

      <Card>
        <View style={styles.rowBetween}>
          <ThemedText type="smallBold">Tempo total</ThemedText>
          <ThemedText
            type="subtitle"
            accessibilityLabel={`Tempo total ${formatDuration(totals.totalSec)}`}>
            {formatDuration(totals.totalSec)}
          </ThemedText>
        </View>
        <Button title="Salvar" onPress={save} loading={saving} />
      </Card>

      {editingCycle ? (
        <ItemEditorModal
          cycle={editingCycle}
          item={editingItem}
          dispatch={dispatch}
          onClose={() => setEditing(null)}
          library={library}
          onLibraryChange={reloadLibrary}
        />
      ) : null}

      <SoundPickerModal
        visible={!!soundItem}
        title={soundItem ? `Som de ${soundItem.label || 'exercício'}` : ''}
        library={library}
        selected={soundItem?.workSoundId ?? null}
        inheritLabel="Som do treino (padrão)"
        onSelect={(workSoundId) =>
          pickingSound &&
          dispatch({
            type: 'updateItem',
            cycleId: pickingSound.cycleId,
            itemId: pickingSound.itemId,
            changes: { workSoundId },
          })
        }
        onClose={() => setPickingSound(null)}
        onLibraryChange={reloadLibrary}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cycleActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.one },
  items: { gap: Spacing.one },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingLeft: Spacing.two,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  itemIndex: { width: 20, textAlign: 'center' },
  itemLabel: { flex: 1 },
  itemSound: { fontSize: 12, lineHeight: 16 },
  errors: { gap: Spacing.one },
});
