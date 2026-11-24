import { useLocalSearchParams } from 'expo-router';

import { SoundSettingsScreen } from '@/features/sounds/sound-settings-screen';

export default function WorkoutSoundsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SoundSettingsScreen scope={{ type: 'workout', workoutId: id }} />;
}
