import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Texto/símbolo exibido (ex.: "↑", "★"). */
  glyph?: string;
  /** Ícone nativo (tem prioridade sobre `glyph`). */
  icon?: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  color?: string;
};

export function IconButton({ glyph, icon, label, onPress, disabled, style, color }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
        style,
      ]}>
      {icon ? (
        <Icon name={icon} size={18} color={color ?? theme.text} />
      ) : (
        <ThemedText type="smallBold" style={color ? { color } : undefined}>
          {glyph}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
