import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { showAlert } from '@/components/ui/app-dialog';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useAuth, useServices } from '@/providers/services-provider';

export function SettingsScreen() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const router = useRouter();
  const { backupService, workoutsStore } = useServices();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const exportAll = async () => {
    setBusy('export');
    try {
      const count = await backupService.exportAll();
      if (count === 0) showAlert('Nada para exportar', 'Crie um treino primeiro.');
    } catch {
      showAlert('Não foi possível exportar', 'Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const importFile = async () => {
    setBusy('import');
    try {
      const result = await backupService.importFromFile();
      if (result.status === 'error') showAlert('Não foi possível importar', result.reason);
      if (result.status === 'imported') {
        await workoutsStore.getState().load();
        showAlert(
          'Treinos importados',
          `${result.imported} treino(s) importado(s)` +
            (result.skipped ? `, ${result.skipped} ignorado(s) por estarem inválidos.` : '.'),
        );
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="Configurações" scroll>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Conta</ThemedText>
        <ThemedText>{user?.displayName}</ThemedText>
        {user?.email ? <ThemedText themeColor="textSecondary">{user.email}</ThemedText> : null}
      </ThemedView>
      <Button title="Sons e alertas" variant="secondary" onPress={() => router.push('/sounds')} />
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Backup</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Exporte seus treinos para um arquivo JSON e importe em outro aparelho.
        </ThemedText>
        <Button
          title="Exportar treinos"
          variant="secondary"
          loading={busy === 'export'}
          onPress={exportAll}
        />
        <Button
          title="Importar treinos"
          variant="secondary"
          loading={busy === 'import'}
          onPress={importFile}
        />
      </ThemedView>
      <View style={styles.spacer} />
      <Button title="Sair" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  spacer: { flex: 1 },
});
