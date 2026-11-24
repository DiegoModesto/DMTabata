import { useState } from 'react';
import { Alert, Linking, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { RECORDING_LIMITS, type SoundEntry } from '@/domain/sounds';
import { useTheme } from '@/hooks/use-theme';
import { useServices } from '@/providers/services-provider';

import { useSoundRecorder } from './use-sound-recorder';

type Props = {
  visible: boolean;
  /** Nome proposto, ex.: "Gravação 2". */
  suggestedName: string;
  onSaved: (sound: SoundEntry) => void;
  onClose: () => void;
};

const seconds = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');

/** Grava um som curto pelo microfone (até 3 s), permite ouvir, regravar e salvar. */
export function RecordSoundModal({ visible, suggestedName, onSaved, onClose }: Props) {
  const theme = useTheme();
  const { soundService } = useServices();
  const recorder = useSoundRecorder();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { status, elapsedMs, recording } = recorder;
  const progress = Math.min(1, elapsedMs / RECORDING_LIMITS.maxMs);

  const discardAndClose = () => {
    if (status === 'recording') void recorder.stop();
    const previous = recorder.reset();
    if (previous) void soundService.discardRecording(previous.uri);
    setName('');
    onClose();
  };

  const rerecord = async () => {
    const previous = recorder.reset();
    if (previous) void soundService.discardRecording(previous.uri);
    await recorder.start();
  };

  const save = async () => {
    if (!recording) return;
    setSaving(true);
    try {
      const result = await soundService.saveRecording({ ...recording, name, suggestedName });
      if (result.status === 'rejected') {
        recorder.reset();
        Alert.alert('Não foi possível salvar', result.reason);
        return;
      }
      recorder.reset();
      setName('');
      onSaved(result.sound);
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente gravar novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={discardAndClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <ThemedText type="smallBold" accessibilityRole="header" style={styles.title}>
            Gravar som
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Grave um som curto de até 3 segundos — sua voz contando, uma palma, um grito de guerra.
          </ThemedText>

          <View
            style={[styles.track, { backgroundColor: theme.backgroundElement }]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Tempo gravado"
            accessibilityValue={{ min: 0, max: 3, now: Number((elapsedMs / 1000).toFixed(1)) }}>
            <View
              style={[
                styles.fill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: status === 'recording' ? theme.danger : theme.primary,
                },
              ]}
            />
          </View>
          <View style={styles.statusRow}>
            {status === 'recording' ? (
              <>
                <View style={[styles.recDot, { backgroundColor: theme.danger }]} />
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  Gravando
                </ThemedText>
              </>
            ) : null}
            <ThemedText type="smallBold" style={styles.tabular}>
              {seconds(elapsedMs)} s / 3,0 s
            </ThemedText>
          </View>

          {status === 'denied' ? (
            <View style={styles.gap}>
              <ThemedText type="small" style={{ color: theme.danger }}>
                Sem acesso ao microfone. Libere a permissão nos ajustes do aparelho.
              </ThemedText>
              <Button
                title="Abrir ajustes"
                variant="secondary"
                onPress={() => void Linking.openSettings()}
              />
            </View>
          ) : null}
          {status === 'error' ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Não foi possível gravar. Tente novamente.
            </ThemedText>
          ) : null}

          {status === 'recording' ? (
            <Button title="Parar" icon="stop" onPress={() => void recorder.stop()} />
          ) : status === 'recorded' && recording ? (
            <View style={styles.gap}>
              <View style={styles.row}>
                <Button
                  title={recorder.playing ? 'Pausar' : 'Ouvir'}
                  icon={recorder.playing ? 'pause' : 'play'}
                  variant="secondary"
                  onPress={recorder.togglePlayback}
                  style={styles.flex}
                />
                <Button
                  title="Regravar"
                  icon="redo"
                  variant="secondary"
                  onPress={() => void rerecord()}
                  style={styles.flex}
                />
              </View>
              <TextField
                label="Nome do som"
                placeholder={suggestedName}
                value={name}
                onChangeText={setName}
                maxLength={40}
              />
              <Button title="Salvar som" disabled={saving} onPress={() => void save()} />
            </View>
          ) : (
            <Button title="Gravar" icon="record" onPress={() => void recorder.start()} />
          )}

          <Button title="Cancelar" variant="ghost" onPress={discardAndClose} />
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: { fontSize: 18 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  tabular: { fontVariant: ['tabular-nums'] },
  gap: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
