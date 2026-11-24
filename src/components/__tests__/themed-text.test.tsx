import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { fixedLineHeight, MIN_LINE_HEIGHT_RATIO, ThemedText } from '../themed-text';

describe('ThemedText — texto não corta no topo', () => {
  it('fonte aumentada sem altura de linha ganha altura proporcional', () => {
    expect(fixedLineHeight({ fontSize: 22 })).toBe(Math.ceil(22 * MIN_LINE_HEIGHT_RATIO));
    expect(fixedLineHeight({ fontSize: 18 })).toBe(24);
  });

  it('não mexe quando a tela já define a altura ou não muda a fonte', () => {
    expect(fixedLineHeight({ fontSize: 112, lineHeight: 124 })).toBeUndefined();
    expect(fixedLineHeight({ color: 'red' })).toBeUndefined();
    expect(fixedLineHeight(undefined)).toBeUndefined();
  });

  it('aplica no componente: "TRABALHO" com fonte 22 não herda a linha 20 do tipo', async () => {
    await render(
      <ThemedText type="smallBold" style={{ fontSize: 22 }}>
        TRABALHO
      </ThemedText>,
    );
    const style = StyleSheet.flatten(screen.getByText('TRABALHO').props.style);
    expect(style.lineHeight).toBeGreaterThanOrEqual(22 * MIN_LINE_HEIGHT_RATIO);
  });

  it('tipos sem sobrescrita mantêm a altura de linha do tipo', async () => {
    await render(<ThemedText type="subtitle">Exercício 1</ThemedText>);
    expect(StyleSheet.flatten(screen.getByText('Exercício 1').props.style).lineHeight).toBe(44);
  });
});
