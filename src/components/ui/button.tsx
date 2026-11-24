import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
  /** Ícone à esquerda do texto. */
  icon?: IconName;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
  ...rest
}: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const background = {
    primary: theme.primary,
    secondary: theme.backgroundElement,
    danger: theme.danger,
    ghost: 'transparent',
  }[variant];
  const color = variant === 'primary' || variant === 'danger' ? theme.onPrimary : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Icon name={icon} size={18} color={color} /> : null}
          <ThemedText type="smallBold" style={[styles.label, { color }]}>
            {title}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontSize: 16 },
});
