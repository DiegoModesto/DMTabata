import { SoundSettingsScreen } from '@/features/sounds/sound-settings-screen';

const GLOBAL_SCOPE = { type: 'global' } as const;

export default function GlobalSoundsRoute() {
  return <SoundSettingsScreen scope={GLOBAL_SCOPE} />;
}
