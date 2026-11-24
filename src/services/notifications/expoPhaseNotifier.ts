import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { PhaseNotifier } from './phaseNotifier';

const CHANNEL_ID = 'treino';

export function createExpoPhaseNotifier(): PhaseNotifier {
  let configured = false;

  async function configure() {
    if (configured) return;
    configured = true;
    // Com o app aberto o próprio player toca os alertas; as notificações são canceladas.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Trocas de fase do treino',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 100, 250],
      });
    }
  }

  return {
    async ensurePermission() {
      await configure();
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    },

    async schedule(list) {
      await configure();
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const n of list) {
        await Notifications.scheduleNotificationAsync({
          content: { title: n.title, body: n.body, sound: n.sound ?? false },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: n.fireAt,
            channelId: CHANNEL_ID,
          },
        });
      }
    },

    async cancelAll() {
      await Notifications.cancelAllScheduledNotificationsAsync();
    },
  };
}
