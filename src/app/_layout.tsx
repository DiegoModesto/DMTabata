import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { detailHeaderOptions } from '@/components/navigation/detail-header';
import { DialogHost } from '@/components/ui/app-dialog';
import { StartupErrorScreen } from '@/features/startup/startup-error-screen';
import { useTheme } from '@/hooks/use-theme';
import { ServicesProvider, useAuth } from '@/providers/services-provider';
import { createExpoAlertPlayer } from '@/services/audio/expoAlertPlayer';
import { createExpoSoundImporter } from '@/services/audio/expoSoundImporter';
import { createExpoBackupIO } from '@/services/backup/expoBackupIO';
import { createExpoPhaseNotifier } from '@/services/notifications/expoPhaseNotifier';
import type { ServiceOverrides } from '@/services/container';
import { openAppDatabase } from '@/services/db/expoDatabase';

SplashScreen.preventAutoHideAsync();

const createOverrides = (): ServiceOverrides => ({
  alertPlayer: createExpoAlertPlayer(),
  soundImporter: createExpoSoundImporter(),
  phaseNotifier: createExpoPhaseNotifier(),
  backupIO: createExpoBackupIO(),
});

function RootNavigator() {
  const status = useAuth((s) => s.status);
  const signedIn = status === 'signedIn';
  const theme = useTheme();
  const detail = detailHeaderOptions(theme);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/templates" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/[id]/index" options={detail} />
        <Stack.Screen name="workout/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/[id]/sounds" options={detail} />
        <Stack.Screen name="sounds" options={detail} />
        <Stack.Screen name="workout/[id]/stats" options={detail} />
        <Stack.Screen name="session/[id]/index" options={detail} />
        <Stack.Screen name="session/[id]/feedback" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="player/[id]"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const handleError = useCallback((error: unknown) => {
    console.error('Falha ao iniciar o app', error);
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ServicesProvider
        openDatabase={openAppDatabase}
        createOverrides={createOverrides}
        onError={handleError}
        errorFallback={(error, retry) => (
          <StartupErrorScreen
            error={error}
            // Na web, recarregar a página libera o banco de forma limpa.
            onRetry={Platform.OS === 'web' ? () => window.location.reload() : retry}
          />
        )}>
        <RootNavigator />
        <DialogHost />
      </ServicesProvider>
    </ThemeProvider>
  );
}
