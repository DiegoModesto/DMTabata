import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { HOLD, holdTick, Stepper } from '../stepper';

function Harness({ initial = 30, min = 0, max = 3600 }) {
  const [value, setValue] = useState(initial);
  return <Stepper label="Trabalho" value={value} onChange={setValue} min={min} max={max} />;
}

const valueText = () => screen.getByLabelText(/^Trabalho: /).props.accessibilityLabel;

describe('Stepper — toque e segurar', () => {
  afterEach(() => jest.useRealTimers());

  it('cada toque muda de 1 em 1', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar Trabalho' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar Trabalho' }));
    expect(valueText()).toBe('Trabalho: 0:32');
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuir Trabalho' }));
    expect(valueText()).toBe('Trabalho: 0:31');
  });

  it('segurar repete e acelera até soltar', async () => {
    jest.useFakeTimers();
    await render(<Harness />);
    const plus = screen.getByRole('button', { name: 'Aumentar Trabalho' });
    await fireEvent(plus, 'longPress');
    expect(valueText()).toBe('Trabalho: 0:31');
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    const afterOneSecond = Number(valueText().split(':').at(-1));
    expect(afterOneSecond).toBeGreaterThan(36); // bem mais que 1 por toque
    await fireEvent(plus, 'pressOut');
    const frozen = valueText();
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(valueText()).toBe(frozen);
  });

  it('segurar respeita os limites e para no máximo', async () => {
    jest.useFakeTimers();
    await render(<Harness initial={95} max={100} />);
    await fireEvent(screen.getByRole('button', { name: 'Aumentar Trabalho' }), 'longPress');
    await act(async () => {
      jest.advanceTimersByTime(3_000);
    });
    expect(valueText()).toBe('Trabalho: 1:40');
    expect(screen.getByRole('button', { name: 'Aumentar Trabalho' })).toBeDisabled();
  });

  it('não desce abaixo do mínimo', async () => {
    await render(<Harness initial={16} min={16} />);
    expect(screen.getByRole('button', { name: 'Diminuir Trabalho' })).toBeDisabled();
  });
});

describe('holdTick — ritmo da repetição', () => {
  it('intervalo diminui até o mínimo e o passo grande entra depois de um tempo', () => {
    expect(holdTick(0)).toEqual({ intervalMs: HOLD.startIntervalMs, multiplier: 1 });
    expect(holdTick(5).intervalMs).toBeLessThan(holdTick(1).intervalMs);
    expect(holdTick(100).intervalMs).toBe(HOLD.minIntervalMs);
    expect(holdTick(HOLD.bigStepAfter - 1).multiplier).toBe(1);
    expect(holdTick(HOLD.bigStepAfter).multiplier).toBe(HOLD.bigStepFactor);
  });
});
