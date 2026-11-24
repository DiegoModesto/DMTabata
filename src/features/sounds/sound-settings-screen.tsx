import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Stepper } from '@/components/ui/stepper';
import { Spacing } from '@/constants/theme';
import {
  ALERT_SLOT_LABELS,
  ALERT_SLOTS,
  DEFAULT_ALERT_SETTINGS,
  type AlertSettings,
  type AlertSlot,
} from '@/domain/alerts';
import {
  applySoundConfig,
  COUNTDOWN_MAX,
  emptySoundConfig,
  resolveAlertSettings,
  type SoundConfig,
} from '@/domain/soundConfig';
import { nextRecordingName, PERSONAL_PACK_PRESET, soundName } from '@/domain/sounds';
import { useTheme } from '@/hooks/use-theme';
import { useServices } from '@/providers/services-provider';

import { RecordSoundModal } from './record-sound-modal';
import { SoundPickerModal } from './sound-picker-modal';
import { SoundRow } from './sound-row';
import { useSoundLibrary } from './use-sound-library';
import { previewButton, useSoundPreview } from './use-sound-preview';

export type SoundScope = { type: 'global' } | { type: 'workout'; workoutId: string };

type BoolField = 'hapticsEnabled' | 'halfwayAlert' | 'voiceEnabled' | 'announceNext' | 'duckMusic';

const SWITCHES: { field: BoolField; label: string }[] = [
  { field: 'hapticsEnabled', label: 'Vibração' },
  { field: 'halfwayAlert', label: 'Aviso na metade do trabalho' },
  { field: 'voiceEnabled', label: 'Narração por voz' },
  { field: 'announceNext', label: 'Anunciar próximo exercício' },
  { field: 'duckMusic', label: 'Abaixar a música de outros apps' },
];

function SwitchRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.rowBetween}>
      <ThemedText type="small" style={styles.flex}>
        {label}
      </ThemedText>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      />
    </View>
  );
}

export function SoundSettingsScreen({ scope }: { scope: SoundScope }) {
  const theme = useTheme();
  const { soundService } = useServices();
  const { library, reload } = useSoundLibrary();
  const preview = useSoundPreview();
  const [config, setConfig] = useState<SoundConfig | null>(null);
  const [base, setBase] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [picking, setPicking] = useState<AlertSlot | null>(null);
  const [pickingSurprise, setPickingSurprise] = useState(false);
  const [pickingMusic, setPickingMusic] = useState(false);
  const [recording, setRecording] = useState(false);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const global = await soundService.globalConfig();
      const own =
        scope.type === 'global' ? global : await soundService.workoutConfig(scope.workoutId);
      if (!active) return;
      setBase(scope.type === 'global' ? DEFAULT_ALERT_SETTINGS : resolveAlertSettings(global));
      setConfig(own);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [scope, soundService, version]);

  const settings = useMemo(() => applySoundConfig(base, config), [base, config]);

  const update = (changes: Partial<SoundConfig>) => {
    if (!config) return;
    const next = { ...config, ...changes };
    setConfig(next);
    void soundService.saveConfig(next);
  };

  const setSound = (slot: AlertSlot, soundId: string | null) => {
    if (!config) return;
    update({ sounds: { ...config.sounds, [slot]: soundId } });
  };

  const applyPersonalPack = () => {
    if (!config) return;
    update({
      sounds: { ...config.sounds, ...PERSONAL_PACK_PRESET.sounds },
      surpriseSounds: [...PERSONAL_PACK_PRESET.surpriseSounds],
      backgroundMusicId: PERSONAL_PACK_PRESET.backgroundMusicId,
    });
  };

  const togglePersonalize = async (on: boolean) => {
    if (scope.type !== 'workout') return;
    if (on) setConfig(await soundService.personalizeWorkout(scope.workoutId));
    else {
      await soundService.useGlobalForWorkout(scope.workoutId);
      setConfig(null);
    }
  };

  const importSound = async () => {
    const result = await soundService.importSound();
    if (result.status === 'rejected') Alert.alert('Não foi possível importar', result.reason);
    if (result.status === 'imported') {
      reload();
      Alert.alert('Som importado', `"${result.sound.name}" já pode ser usado nos treinos.`);
    }
  };

  const confirmRemove = (id: string, name: string) =>
    Alert.alert('Remover som?', `Onde "${name}" era usado, volta o som padrão.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await soundService.removeSound(id);
          reload();
          load();
        },
      },
    ]);

  const title = scope.type === 'global' ? 'Sons globais' : 'Sons do treino';
  if (!loaded) return <Screen title={title}>{null}</Screen>;

  const editable = config !== null;
  const userSounds = library.filter((s) => s.source === 'user');

  return (
    <Screen title={title} scroll>
      {scope.type === 'workout' ? (
        <Card>
          <SwitchRow
            label="Personalizar sons deste treino"
            value={editable}
            onChange={(on) => void togglePersonalize(on)}
          />
          {!editable ? (
            <ThemedText type="small" themeColor="textSecondary">
              Usando os sons globais. Ative para escolher sons só para este treino.
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <ThemedText type="smallBold">Sons por momento</ThemedText>
        {ALERT_SLOTS.map((slot) => (
          <SoundRow
            key={slot}
            label={ALERT_SLOT_LABELS[slot]}
            value={soundName(settings.sounds[slot], library)}
            inherited={!config || config.sounds[slot] === null}
            onPress={() => (editable ? setPicking(slot) : undefined)}
            playing={preview.isPlaying(`slot:${slot}`)}
            onPreview={
              settings.sounds[slot]
                ? () => preview.toggle(`slot:${slot}`, settings.sounds[slot]!, settings.volume)
                : undefined
            }
          />
        ))}
      </Card>

      <Card>
        <Stepper
          label="Volume dos alertas"
          format="count"
          suffix="%"
          step={10}
          min={0}
          max={100}
          value={Math.round(settings.volume * 100)}
          onChange={(v) => editable && update({ volume: v / 100 })}
        />
        <Stepper
          label="Bipes antes da troca"
          format="count"
          suffix="s"
          step={1}
          min={0}
          max={COUNTDOWN_MAX}
          value={settings.countdownFrom}
          onChange={(v) => editable && update({ countdownFrom: v })}
        />
        {SWITCHES.map(({ field, label }) => (
          <SwitchRow
            key={field}
            label={label}
            value={settings[field]}
            disabled={!editable}
            onChange={(v) => update({ [field]: v })}
          />
        ))}
      </Card>

      <Card>
        <ThemedText type="smallBold">Música de fundo</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Toca em loop durante o treino, abaixo dos alertas e dos sons surpresa. Pausa e para junto
          com o treino.
        </ThemedText>
        <SoundRow
          label="Música"
          value={
            settings.backgroundMusicId ? soundName(settings.backgroundMusicId, library) : 'Nenhuma'
          }
          inherited={!config || config.backgroundMusicId === null}
          onPress={() => (editable ? setPickingMusic(true) : undefined)}
          playing={preview.isPlaying('music')}
          onPreview={
            settings.backgroundMusicId
              ? () =>
                  preview.toggle(
                    'music',
                    settings.backgroundMusicId!,
                    settings.volume * settings.musicVolume,
                  )
              : undefined
          }
        />
        <Stepper
          label="Volume da música"
          format="count"
          suffix="%"
          step={5}
          min={5}
          max={100}
          value={Math.round(settings.musicVolume * 100)}
          onChange={(v) => editable && update({ musicVolume: v / 100 })}
        />
      </Card>

      <Card>
        <ThemedText type="smallBold">Sons surpresa</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Durante o trabalho, em momentos sorteados, toca um destes sons. Um novo interrompe o
          anterior, e pausar ou terminar o treino silencia.
          {config && config.surpriseSounds === null && settings.surpriseSounds.length
            ? ' (padrão)'
            : ''}
        </ThemedText>
        {settings.surpriseSounds.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nenhum som surpresa escolhido.
          </ThemedText>
        ) : (
          settings.surpriseSounds.map((id) => {
            const name = soundName(id, library);
            return (
              <View key={id} style={styles.rowBetween}>
                <ThemedText type="small" style={styles.flex}>
                  {name}
                </ThemedText>
                <IconButton
                  {...previewButton(preview.isPlaying(`surprise:${id}`), `surpresa ${name}`)}
                  onPress={() => preview.toggle(`surprise:${id}`, id, settings.volume)}
                />
                {editable ? (
                  <IconButton
                    glyph="✕"
                    label={`Tirar ${name} das surpresas`}
                    color={theme.danger}
                    onPress={() =>
                      update({
                        surpriseSounds: settings.surpriseSounds.filter((s) => s !== id),
                      })
                    }
                  />
                ) : null}
              </View>
            );
          })
        )}
        <Stepper
          label="Chance por exercício"
          format="count"
          suffix="%"
          step={10}
          min={10}
          max={100}
          value={Math.round(settings.surpriseChance * 100)}
          onChange={(v) => editable && update({ surpriseChance: v / 100 })}
        />
        {editable ? (
          <Button
            title="Adicionar som surpresa"
            variant="secondary"
            onPress={() => setPickingSurprise(true)}
          />
        ) : null}
      </Card>

      {scope.type === 'global' && editable ? (
        <Button
          title="Usar pacote pessoal"
          variant="secondary"
          onPress={() =>
            Alert.alert(
              'Usar pacote pessoal?',
              'Aplica Vamo acordar na preparação, Corneta no trabalho, Campainha de boxe no descanso, Cabou no fim, os 12 sons surpresa e a música de fundo.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Aplicar', onPress: applyPersonalPack },
              ],
            )
          }
        />
      ) : null}

      {editable ? (
        <Button
          title="Restaurar padrão"
          variant="ghost"
          onPress={() => config && update(emptySoundConfig(config.id, config.name))}
        />
      ) : null}

      <Card>
        <ThemedText type="smallBold">Meus sons</ThemedText>
        {userSounds.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Grave um som de até 3 segundos ou importe arquivos de áudio curtos (mp3, wav, m4a — até
            1 MB).
          </ThemedText>
        ) : (
          userSounds.map((s) => (
            <View key={s.id} style={styles.rowBetween}>
              <ThemedText type="small" style={styles.flex}>
                {s.name}
              </ThemedText>
              <IconButton
                {...previewButton(preview.isPlaying(`mine:${s.id}`), s.name)}
                onPress={() => preview.toggle(`mine:${s.id}`, s.id)}
              />
              <IconButton
                glyph="✕"
                label={`Remover ${s.name}`}
                color={theme.danger}
                onPress={() => confirmRemove(s.id, s.name)}
              />
            </View>
          ))
        )}
        <View style={styles.buttons}>
          <Button
            title="Gravar som"
            icon="mic"
            variant="secondary"
            onPress={() => setRecording(true)}
            style={styles.flex}
          />
          <Button
            title="Importar som"
            icon="upload"
            variant="secondary"
            onPress={importSound}
            style={styles.flex}
          />
        </View>
      </Card>

      <RecordSoundModal
        visible={recording}
        suggestedName={nextRecordingName(library)}
        onClose={() => setRecording(false)}
        onSaved={(sound) => {
          setRecording(false);
          reload();
          Alert.alert('Som gravado', `"${sound.name}" já pode ser usado nos treinos.`);
        }}
      />

      <SoundPickerModal
        visible={pickingMusic}
        title="Música de fundo"
        library={library}
        selected={config ? config.backgroundMusicId : null}
        inheritLabel={`Padrão (${base.backgroundMusicId ? soundName(base.backgroundMusicId, library) : 'Nenhuma'})`}
        onSelect={(id) => update({ backgroundMusicId: id })}
        onClose={() => setPickingMusic(false)}
      />

      <SoundPickerModal
        visible={pickingSurprise}
        title="Adicionar som surpresa"
        library={library.filter((s) => !settings.surpriseSounds.includes(s.id))}
        selected={null}
        hideSilent
        onSelect={(id) => id && update({ surpriseSounds: [...settings.surpriseSounds, id] })}
        onClose={() => setPickingSurprise(false)}
      />

      <SoundPickerModal
        visible={picking !== null}
        title={picking ? ALERT_SLOT_LABELS[picking] : ''}
        library={library}
        selected={picking && config ? config.sounds[picking] : null}
        inheritLabel={picking ? `Padrão (${soundName(base.sounds[picking], library)})` : undefined}
        onSelect={(id) => picking && setSound(picking, id)}
        onClose={() => setPicking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 44,
  },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
});
