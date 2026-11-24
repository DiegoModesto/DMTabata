import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';

import { previewButton } from './use-sound-preview';

type Props = {
  label: string;
  value: string;
  inherited?: boolean;
  onPress: () => void;
  onPreview?: () => void;
  /** Pré-escuta tocando: o botão vira "pausar". */
  playing?: boolean;
};

/** Linha "Evento → som escolhido" que abre o seletor. */
export function SoundRow({ label, value, inherited, onPress, onPreview, playing = false }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}${inherited ? ' (padrão)' : ''}`}
        accessibilityHint="Toque para trocar o som"
        onPress={onPress}>
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
        <ThemedText type="smallBold" themeColor={inherited ? 'textSecondary' : 'text'}>
          {value}
          {inherited ? ' (padrão)' : ''} ›
        </ThemedText>
      </Pressable>
      {onPreview ? <IconButton {...previewButton(playing, label)} onPress={onPreview} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  main: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    gap: Spacing.two,
  },
  label: { flexShrink: 1 },
});
