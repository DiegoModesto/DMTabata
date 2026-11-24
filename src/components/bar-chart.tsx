import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Bar = { key: string; value: number; label: string; valueLabel: string };

type Props = {
  title: string;
  bars: Bar[];
  height?: number;
  color?: string;
  /** Valor máximo da escala (padrão: maior valor). */
  max?: number;
};

/**
 * Gráfico de barras simples feito com Views (sem dependência nativa).
 * Acessível: cada barra é anunciada com rótulo e valor.
 */
export function BarChart({ title, bars, height = 120, color, max }: Props) {
  const theme = useTheme();
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  const fill = color ?? theme.primary;

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {bars.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Sem dados no período.
        </ThemedText>
      ) : (
        <View style={[styles.chart, { height }]}>
          {bars.map((bar) => (
            <View
              key={bar.key}
              style={styles.column}
              accessible
              accessibilityLabel={`${bar.label}: ${bar.valueLabel}`}>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(2, (bar.value / top) * 100)}%`,
                      backgroundColor: bar.value > 0 ? fill : theme.border,
                    },
                  ]}
                />
              </View>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.label}>
                {bar.label}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.one },
  column: { flex: 1, height: '100%', alignItems: 'center' },
  barArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  label: { fontSize: 10, lineHeight: 14 },
});
