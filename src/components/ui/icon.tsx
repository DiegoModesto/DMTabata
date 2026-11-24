import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/** Ícones do app: SF Symbols no iOS e Material Symbols no Android/web. */
const ICONS = {
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  stop: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  previous: { ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' },
  next: { ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  unlock: { ios: 'lock.open.fill', android: 'lock_open', web: 'lock_open' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  mic: { ios: 'mic.fill', android: 'mic', web: 'mic' },
  record: { ios: 'record.circle', android: 'radio_button_checked', web: 'radio_button_checked' },
  redo: { ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' },
  upload: { ios: 'square.and.arrow.down', android: 'file_download', web: 'file_download' },
} as const;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color: ColorValue;
};

export function Icon({ name, size = 20, color }: Props) {
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color}
      weight="semibold"
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
