import { Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
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
export function ItemEditorModal({ cycle, item, dispatch, onClose }: Props) {
  if (!item) return null;
  const update = (changes: Partial<Pick<CycleItem, 'label' | 'workSec' | 'restSec'>>) =>
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
