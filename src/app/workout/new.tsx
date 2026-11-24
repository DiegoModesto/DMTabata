import { useLocalSearchParams } from 'expo-router';

import { isWorkoutType } from '@/domain/templates';
import { WorkoutEditorScreen } from '@/features/workouts/workout-editor-screen';

export default function NewWorkoutRoute() {
  const { template } = useLocalSearchParams<{ template?: string }>();
  return <WorkoutEditorScreen template={isWorkoutType(template) ? template : 'custom'} />;
}
