import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/services-provider';

export function SettingsScreen() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  return (
    <Screen title="Configurações" scroll>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Conta</ThemedText>
        <ThemedText>{user?.displayName}</ThemedText>
        {user?.email ? <ThemedText themeColor="textSecondary">{user.email}</ThemedText> : null}
      </ThemedView>
      <View style={styles.spacer} />
      <Button title="Sair" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  spacer: { flex: 1 },
});
