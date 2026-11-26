import { useSyncExternalStore } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';

/**
 * Alertas e confirmações que funcionam em todas as plataformas.
 *
 * No app nativo usamos o `Alert.alert` do sistema. Na web (PWA) o `Alert.alert` do
 * react-native-web não faz nada — confirmações como "Parar treino?" ou "Excluir treino?"
 * simplesmente sumiriam — então mostramos um diálogo próprio, desenhado pelo `DialogHost`.
 */

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type Dialog = { title: string; message?: string; buttons: DialogButton[] };

const OK: DialogButton[] = [{ text: 'OK' }];

let queue: Dialog[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Enfileira um diálogo para o `DialogHost` (usado na web). */
export function presentDialog(title: string, message?: string, buttons?: DialogButton[]) {
  queue = [...queue, { title, message, buttons: buttons?.length ? buttons : OK }];
  emit();
}

/** Mesmo contrato do `Alert.alert`, mas também funciona no navegador. */
export function showAlert(...args: [title: string, message?: string, buttons?: DialogButton[]]) {
  if (Platform.OS === 'web') presentDialog(...args);
  else Alert.alert(...args);
}

function dismiss(button?: DialogButton) {
  queue = queue.slice(1);
  emit();
  button?.onPress?.();
}

/** Limpa a fila (para testes). */
export function resetDialogs() {
  queue = [];
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const current = () => queue[0] ?? null;

const variantOf = (button: DialogButton) =>
  button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'secondary' : 'primary';

/** Desenha o diálogo da vez. Fica na raiz do app. */
export function DialogHost() {
  const dialog = useSyncExternalStore(subscribe, current, current);
  if (!dialog) return null;
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  // Ação principal por último (embaixo), como no iOS com 3+ botões.
  const ordered = [
    ...dialog.buttons.filter((b) => b.style !== 'cancel'),
    ...(cancel ? [cancel] : []),
  ];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => dismiss(cancel)}>
      <View style={styles.backdrop}>
        {/* Tocar fora equivale a "Cancelar" (quando existe). */}
        <Pressable
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={() => (cancel ? dismiss(cancel) : undefined)}
        />
        <ThemedView type="background" accessibilityRole="alert" style={styles.sheet}>
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
            {dialog.title}
          </ThemedText>
          {dialog.message ? (
            <ThemedText themeColor="textSecondary">{dialog.message}</ThemedText>
          ) : null}
          <View style={styles.buttons}>
            {ordered.map((button) => (
              <Button
                key={button.text}
                title={button.text}
                variant={variantOf(button)}
                onPress={() => dismiss(button)}
              />
            ))}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: { fontSize: 22, lineHeight: 28 },
  buttons: { gap: Spacing.two, marginTop: Spacing.one },
});
