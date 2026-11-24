import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { ServicesProvider, useAuth } from '@/providers/services-provider';
import { createExpoAlertPlayer } from '@/services/audio/expoAlertPlayer';
import type { ServiceOverrides } from '@/services/container';
import { openAppDatabase } from '@/services/db/expoDatabase';

SplashScreen.preventAutoHideAsync();

const createOverrides = (): ServiceOverrides => ({ alertPlayer: createExpoAlertPlayer() });

function RootNavigator() {
  const status = useAuth((s) => s.status);
  const signedIn = status === 'signedIn';

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
        <Stack.Screen name="workout/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/[id]/index" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="workout/[id]/edit" options={{ presentation: 'modal' }} />
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
        onError={handleError}>
        <RootNavigator />
      </ServicesProvider>
    </ThemeProvider>
  );
}
