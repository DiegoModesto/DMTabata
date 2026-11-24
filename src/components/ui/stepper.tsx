import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
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

/**
 * Ritmo da repetição ao segurar: começa devagar e acelera; depois de um tempo,
 * cada repetição vale 5 passos. Exportado para testes.
 */
export const HOLD = {
  delayMs: 350,
  startIntervalMs: 160,
  minIntervalMs: 45,
  acceleration: 0.85,
  bigStepAfter: 15,
  bigStepFactor: 5,
} as const;

/** Intervalo e multiplicador do passo para a n-ésima repetição (0 = primeira). */
export function holdTick(n: number): { intervalMs: number; multiplier: number } {
  const intervalMs = Math.max(
    HOLD.minIntervalMs,
    Math.round(HOLD.startIntervalMs * HOLD.acceleration ** n),
  );
  return { intervalMs, multiplier: n >= HOLD.bigStepAfter ? HOLD.bigStepFactor : 1 };
}

/** Controle −/+ para tempos e contagens. Toque muda 1 passo; segurar repete e acelera. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 3600,
  format = 'time',
  suffix = '',
  highlighted = false,
}: Props) {
  const theme = useTheme();
  const display = format === 'time' ? formatClock(value) : `${value}${suffix}`;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  // Valor/callback mais recentes para a repetição (que roda fora do ciclo de render).
  const latest = useRef({ value, onChange, min, max });
  useEffect(() => {
    latest.current = { value, onChange, min, max };
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopRepeat = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stopRepeat, []);

  const startRepeat = (direction: 1 | -1) => {
    stopRepeat();
    let n = 0;
    const run = () => {
      const { value: current, onChange: emit, min: lo, max: hi } = latest.current;
      const { intervalMs, multiplier } = holdTick(n++);
      const next = Math.min(hi, Math.max(lo, current + direction * step * multiplier));
      if (next === current) return stopRepeat();
      latest.current = { ...latest.current, value: next };
      emit(next);
      timer.current = setTimeout(run, intervalMs);
    };
    run();
  };

  const button = (direction: 1 | -1) => {
    const atLimit = direction > 0 ? value >= max : value <= min;
    const action = direction > 0 ? 'Aumentar' : 'Diminuir';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${action} ${label}`}
        accessibilityHint="Segure para mudar mais rápido"
        accessibilityState={{ disabled: atLimit }}
        disabled={atLimit}
        onPress={() => onChange(clamp(value + direction * step))}
        onLongPress={() => startRepeat(direction)}
        delayLongPress={HOLD.delayMs}
        onPressOut={stopRepeat}
        hitSlop={6}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: pressed ? theme.primary : theme.background,
            opacity: atLimit ? 0.35 : 1,
          },
        ]}>
        {({ pressed }) => (
          <Icon
            name={direction > 0 ? 'plus' : 'minus'}
            size={20}
            color={pressed ? theme.onPrimary : theme.text}
          />
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.row}>
      <ThemedText type="small" style={styles.label}>
        {label}
      </ThemedText>
      <View style={[styles.control, { backgroundColor: theme.backgroundElement }]}>
        {button(-1)}
        <ThemedText
          accessibilityLabel={`${label}: ${display}`}
          style={[styles.value, highlighted && { color: theme.primary }]}>
          {display}
        </ThemedText>
        {button(1)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  label: { flexShrink: 1, marginRight: Spacing.two },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 68,
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
