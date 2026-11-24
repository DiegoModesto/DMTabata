import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/ui/screen';

export default function WorkoutsTab() {
  return (
    <Screen title="Treinos">
      <EmptyState title="Nenhum treino ainda" message="Crie seu primeiro treino para começar." />
    </Screen>
  );
}
