import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { SoundPickerModal } from '@/features/sounds/sound-picker-modal';
import { SoundRow } from '@/features/sounds/sound-row';
import { useSoundLibrary } from '@/features/sounds/use-sound-library';
import { soundName } from '@/domain/sounds';
import type { EditorAction } from '@/domain/workoutEditor';
import {
  effectiveRestSec,
  effectiveWorkSec,
  isItemOverridden,
  LIMITS,
  type Cycle,
  type CycleItem,
} from '@/domain/workout';

type Props = {
  cycle: Cycle;
  item: CycleItem | null;
  dispatch: (action: EditorAction) => void;
  onClose: () => void;
};

/** Edição de um exercício: nome e tempos próprios (sobrescrevendo o padrão do ciclo). */
type SoundField = 'workSoundId' | 'restSoundId';

export function ItemEditorModal({ cycle, item, dispatch, onClose }: Props) {
  const { library } = useSoundLibrary();
  const [picking, setPicking] = useState<SoundField | null>(null);
  if (!item) return null;
  const update = (
    changes: Partial<Pick<CycleItem, 'label' | 'workSec' | 'restSec' | SoundField>>,
  ) =>
    dispatch({ type: 'updateItem', cycleId: cycle.id, itemId: item.id, changes });

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <ThemedText type="smallBold" accessibilityRole="header" style={styles.title}>
            Editar exercício
          </ThemedText>
          <TextField
            label="Nome do exercício"
            value={item.label}
            onChangeText={(label) => update({ label })}
            maxLength={LIMITS.nameMaxLength}
          />
          <Stepper
            label="Trabalho"
            value={effectiveWorkSec(cycle, item)}
            min={LIMITS.minWorkSec}
            onChange={(workSec) => update({ workSec })}
            highlighted={item.workSec !== null}
          />
          <Stepper
            label="Descanso"
            value={effectiveRestSec(cycle, item)}
            onChange={(restSec) => update({ restSec })}
            highlighted={item.restSec !== null}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Padrão do ciclo: {cycle.defaultWorkSec}s de trabalho / {cycle.defaultRestSec}s de
            descanso.
          </ThemedText>
          <ThemedText type="smallBold">Sons deste exercício</ThemedText>
          <SoundRow
            label="Início do trabalho"
            value={item.workSoundId ? soundName(item.workSoundId, library) : 'Som do treino'}
            inherited={item.workSoundId === null}
            onPress={() => setPicking('workSoundId')}
          />
          <SoundRow
            label="Início do descanso"
            value={item.restSoundId ? soundName(item.restSoundId, library) : 'Som do treino'}
            inherited={item.restSoundId === null}
            onPress={() => setPicking('restSoundId')}
          />
          {isItemOverridden(item) ? (
            <Button
              title="Voltar ao padrão do ciclo"
              variant="secondary"
              onPress={() =>
                dispatch({ type: 'resetItemTimes', cycleId: cycle.id, itemId: item.id })
              }
            />
          ) : null}
          <Button
            title="Remover exercício"
            variant="ghost"
            disabled={cycle.items.length <= 1}
            onPress={() => {
              dispatch({ type: 'removeItem', cycleId: cycle.id, itemId: item.id });
              onClose();
            }}
          />
          <Button title="Concluir" onPress={onClose} />
        </ThemedView>
        <SoundPickerModal
          visible={picking !== null}
          title={picking === 'workSoundId' ? 'Início do trabalho' : 'Início do descanso'}
          library={library}
          selected={picking ? item[picking] : null}
          inheritLabel="Som do treino (padrão)"
          onSelect={(id) => picking && update({ [picking]: id })}
          onClose={() => setPicking(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: { fontSize: 18 },
});
