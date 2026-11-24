import { useLocalSearchParams } from 'expo-router';

import { FeedbackScreen } from '@/features/sessions/feedback-screen';

export default function FeedbackRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FeedbackScreen sessionId={id} />;
}
