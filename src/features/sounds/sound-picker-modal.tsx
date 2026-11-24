import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { SILENT_SOUND_ID } from '@/domain/alerts';
import { SILENT_SOUND_NAME, type SoundEntry } from '@/domain/sounds';
import { useTheme } from '@/hooks/use-theme';
import { useServices } from '@/providers/services-provider';

type Option = { id: string | null; name: string; playable: boolean; group?: string };

type Props = {
  visible: boolean;
  title: string;
  library: SoundEntry[];
  /** `null` = herdar. */
  selected: string | null;
  /** Texto da opção "herdar"; se ausente, a opção não aparece. */
  inheritLabel?: string;
  onSelect: (soundId: string | null) => void;
  onClose: () => void;
};

/** Lista de sons com pré-escuta (▶) e seleção. */
export function SoundPickerModal({
  visible,
  title,
  library,
  selected,
  inheritLabel,
  onSelect,
  onClose,
}: Props) {
  const theme = useTheme();
  const { alertPlayer } = useServices();
  const options: Option[] = [
    ...(inheritLabel ? [{ id: null, name: inheritLabel, playable: false }] : []),
    { id: SILENT_SOUND_ID, name: SILENT_SOUND_NAME, playable: false },
    ...library.map((s) => ({
      id: s.id,
      name: s.name,
      playable: true,
      group: s.source === 'user' ? 'Meus sons' : undefined,
    })),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <ThemedText type="smallBold" accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          <ScrollView>
            {options.map((item) => {
              const isSelected = item.id === selected;
              return (
                <View key={item.id ?? 'inherit'} style={styles.row}>
                  <Pressable
                    style={styles.option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={item.name}
                    onPress={() => {
                      onSelect(item.id);
                      onClose();
                    }}>
                    <ThemedText style={isSelected ? { color: theme.primary } : undefined}>
                      {isSelected ? '● ' : '○ '}
                      {item.name}
                      {item.group ? ` · ${item.group}` : ''}
                    </ThemedText>
                  </Pressable>
                  {item.playable && item.id ? (
                    <IconButton
                      glyph="▶"
                      label={`Ouvir ${item.name}`}
                      onPress={() => alertPlayer.preview(item.id!)}
                    />
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
          <Button title="Fechar" variant="secondary" onPress={onClose} />
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: { fontSize: 18 },
  row: { flexDirection: 'row', alignItems: 'center' },
  option: { flex: 1, minHeight: 44, justifyContent: 'center' },
});
