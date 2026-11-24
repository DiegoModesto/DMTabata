import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/ui/screen';

export default function StatsTab() {
  return (
    <Screen title="Estatísticas">
      <EmptyState
        title="Sem estatísticas ainda"
        message="Conclua um treino para ver seu progresso aqui."
      />
    </Screen>
  );
}
