import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showAlert } from '@/components/ui/app-dialog';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { SILENT_SOUND_ID } from '@/domain/alerts';
import {
  groupSounds,
  nextRecordingName,
  SILENT_SOUND_NAME,
  type SoundEntry,
} from '@/domain/sounds';
import { useTheme } from '@/hooks/use-theme';
import { useServices } from '@/providers/services-provider';

import { RecordSoundModal } from './record-sound-modal';

import { previewButton, useSoundPreview } from './use-sound-preview';

type Option = { id: string | null; name: string; playable: boolean };
type Section = { label: string | null; options: Option[] };

type Props = {
  visible: boolean;
  title: string;
  library: SoundEntry[];
  /** `null` = herdar. */
  selected: string | null;
  /** Texto da opção "herdar"; se ausente, a opção não aparece. */
  inheritLabel?: string;
  /** Esconde a opção "Silencioso". */
  hideSilent?: boolean;
  onSelect: (soundId: string | null) => void;
  onClose: () => void;
  /**
   * Mostra "Gravar som" e "Importar som" no seletor: o som novo entra na biblioteca
   * e já fica escolhido. Chamado depois para a tela recarregar a biblioteca.
   */
  onLibraryChange?: () => void;
};

/** Lista de sons com pré-escuta (▶) e seleção. */
export function SoundPickerModal({
  visible,
  title,
  library,
  selected,
  inheritLabel,
  hideSilent,
  onSelect,
  onClose,
  onLibraryChange,
}: Props) {
  const theme = useTheme();
  const preview = useSoundPreview();
  const { soundService } = useServices();
  const [recording, setRecording] = useState(false);
  const close = () => {
    preview.stop();
    onClose();
  };
  const sections: Section[] = [
    {
      label: null,
      options: [
        ...(inheritLabel ? [{ id: null, name: inheritLabel, playable: false }] : []),
        ...(hideSilent ? [] : [{ id: SILENT_SOUND_ID, name: SILENT_SOUND_NAME, playable: false }]),
      ],
    },
    ...groupSounds(library.filter((s) => s.id !== SILENT_SOUND_ID)).map((group) => ({
      label: group.label,
      options: group.sounds.map((s) => ({ id: s.id, name: s.name, playable: true })),
    })),
  ];

  /** Som novo (gravado ou importado): entra na biblioteca e já fica escolhido. */
  const pickNewSound = (sound: SoundEntry) => {
    onLibraryChange?.();
    onSelect(sound.id);
    close();
  };

  const importSound = async () => {
    preview.stop();
    const result = await soundService.importSound();
    if (result.status === 'rejected') showAlert('Não foi possível importar', result.reason);
    if (result.status === 'imported') pickNewSound(result.sound);
  };

  const renderOption = (item: Option) => {
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
            close();
          }}>
          <ThemedText style={isSelected ? { color: theme.primary } : undefined}>
            {isSelected ? '● ' : '○ '}
            {item.name}
          </ThemedText>
        </Pressable>
        {item.playable && item.id ? (
          <IconButton
            {...previewButton(preview.isPlaying(item.id), item.name)}
            onPress={() => preview.toggle(item.id!, item.id!)}
          />
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <ThemedText type="smallBold" accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          <ScrollView>
            {sections.map((section) => (
              <View key={section.label ?? 'base'} style={styles.section}>
                {section.label ? (
                  <ThemedText
                    type="smallBold"
                    themeColor="textSecondary"
                    accessibilityRole="header"
                    style={styles.sectionTitle}>
                    {section.label.toUpperCase()}
                  </ThemedText>
                ) : null}
                {section.options.map(renderOption)}
              </View>
            ))}
          </ScrollView>
          {onLibraryChange ? (
            <View style={styles.buttons}>
              <Button
                title="Gravar som"
                icon="mic"
                variant="secondary"
                style={styles.flex}
                onPress={() => {
                  preview.stop();
                  setRecording(true);
                }}
              />
              <Button
                title="Importar som"
                icon="upload"
                variant="secondary"
                style={styles.flex}
                onPress={() => void importSound()}
              />
            </View>
          ) : null}
          <Button title="Fechar" variant="secondary" onPress={close} />
        </ThemedView>
        {onLibraryChange ? (
          <RecordSoundModal
            visible={recording}
            suggestedName={nextRecordingName(library)}
            onClose={() => setRecording(false)}
            onSaved={(sound) => {
              setRecording(false);
              pickNewSound(sound);
            }}
          />
        ) : null}
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
  section: { marginBottom: Spacing.two },
  sectionTitle: { marginTop: Spacing.two, letterSpacing: 1 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
