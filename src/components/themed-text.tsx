import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

/** Altura de linha mínima, em proporção ao tamanho da fonte, para não cortar acentos/topo. */
export const MIN_LINE_HEIGHT_RATIO = 1.3;

/**
 * Se a tela aumenta a fonte sem ajustar a altura da linha, a linha herdada do tipo
 * fica menor que a letra e o iOS corta o topo do texto. Devolve a altura corrigida
 * (ou `undefined` quando não precisa mudar).
 */
export function fixedLineHeight(override: TextStyle | null | undefined): number | undefined {
  if (!override?.fontSize || override.lineHeight !== undefined) return undefined;
  return Math.ceil(override.fontSize * MIN_LINE_HEIGHT_RATIO);
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const lineHeight = fixedLineHeight(StyleSheet.flatten(style));

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[type],
        style,
        lineHeight ? { lineHeight } : null,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
