import { useLocalSearchParams } from 'expo-router';

import { WorkoutStatsScreen } from '@/features/stats/workout-stats-screen';

export default function WorkoutStatsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutStatsScreen workoutId={id} />;
}
