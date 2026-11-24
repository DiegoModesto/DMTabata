import { useLocalSearchParams } from 'expo-router';

import { ImportWorkoutScreen } from '@/features/library/import-workout-screen';

export default function ImportRoute() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  return <ImportWorkoutScreen uri={uri ?? ''} />;
}
