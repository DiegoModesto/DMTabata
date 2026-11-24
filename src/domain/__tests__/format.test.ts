import { formatClock, formatDuration, msToDisplaySeconds } from '../format';

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [75, '1:15'],
    [600, '10:00'],
    [3725, '1:02:05'],
    [-3, '0:00'],
  ])('%p → %p', (input, expected) => expect(formatClock(input)).toBe(expected));
});

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [60, '1min'],
    [220, '3min40s'],
    [3600, '1h'],
    [3725, '1h02min05s'],
    [3605, '1h05s'],
  ])('%p → %p', (input, expected) => expect(formatDuration(input)).toBe(expected));
});

describe('msToDisplaySeconds', () => {
  it('arredonda para cima, para o relógio mostrar 1 até o último instante', () => {
    expect(msToDisplaySeconds(2001)).toBe(3);
    expect(msToDisplaySeconds(2000)).toBe(2);
    expect(msToDisplaySeconds(1)).toBe(1);
    expect(msToDisplaySeconds(0)).toBe(0);
    expect(msToDisplaySeconds(-50)).toBe(0);
  });
});
