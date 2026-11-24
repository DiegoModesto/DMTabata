import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatClock } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** 'time' exibe m:ss; 'count' exibe o número com sufixo opcional. */
  format?: 'time' | 'count';
  suffix?: string;
  highlighted?: boolean;
};

/** Controle −/+ para tempos e contagens. Acessível: cada botão tem rótulo próprio. */
export function Stepper({
  label,
  value,
  onChange,
  step = 5,
  min = 0,
  max = 3600,
  format = 'time',
  suffix = '',
  highlighted = false,
}: Props) {
  const theme = useTheme();
  const display = format === 'time' ? formatClock(value) : `${value}${suffix}`;
  const change = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));

  return (
    <View style={styles.row}>
      <ThemedText type="small" style={styles.label}>
        {label}
      </ThemedText>
      <View style={[styles.control, { backgroundColor: theme.backgroundElement }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Diminuir ${label}`}
          disabled={value <= min}
          onPress={() => change(-step)}
          hitSlop={8}
          style={[styles.button, { opacity: value <= min ? 0.3 : 1 }]}>
          <ThemedText type="smallBold">−</ThemedText>
        </Pressable>
        <ThemedText
          accessibilityLabel={`${label}: ${display}`}
          type="smallBold"
          style={[styles.value, highlighted && { color: theme.primary }]}>
          {display}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Aumentar ${label}`}
          disabled={value >= max}
          onPress={() => change(step)}
          hitSlop={8}
          style={[styles.button, { opacity: value >= max ? 0.3 : 1 }]}>
          <ThemedText type="smallBold">+</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flexShrink: 1, marginRight: Spacing.two },
  control: { flexDirection: 'row', alignItems: 'center', borderRadius: 10 },
  button: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
