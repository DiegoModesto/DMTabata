import { useLocalSearchParams } from 'expo-router';

import { PlayerScreen } from '@/features/player/player-screen';

export default function PlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlayerScreen workoutId={id} />;
}
