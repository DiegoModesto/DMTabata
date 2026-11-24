import { useLocalSearchParams } from 'expo-router';

import { SessionDetailScreen } from '@/features/sessions/session-detail-screen';

export default function SessionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionDetailScreen sessionId={id} />;
}
