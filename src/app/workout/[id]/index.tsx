import { useLocalSearchParams } from 'expo-router';

import { WorkoutDetailScreen } from '@/features/workouts/workout-detail-screen';

export default function WorkoutDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutDetailScreen workoutId={id} />;
}
