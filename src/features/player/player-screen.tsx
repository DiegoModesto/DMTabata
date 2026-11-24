import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { PhaseColors, Spacing } from '@/constants/theme';
import type { AlertSettings } from '@/domain/alerts';
import { formatClock, formatDuration, msToDisplaySeconds } from '@/domain/format';
import { compileTimeline, type PhaseKind } from '@/domain/timeline';
import type { Workout } from '@/domain/workout';
import { useServices } from '@/providers/services-provider';

import { usePlayer } from './use-player';

export const PHASE_LABELS: Record<PhaseKind, string> = {
  prepare: 'PREPARAR',
  work: 'TRABALHO',
  rest: 'DESCANSO',
  cycleRest: 'DESCANSO ENTRE CICLOS',
  cooldown: 'DESAQUECIMENTO',
};

const WHITE = '#ffffff';

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <View
      style={styles.progressTrack}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
    </View>
  );
}

function PlayerView({ workout, settings }: { workout: Workout; settings: AlertSettings }) {
  useKeepAwake();
  const router = useRouter();
  const { alertPlayer, clock, sessionService } = useServices();
  const timeline = useMemo(() => compileTimeline(workout), [workout]);
  const { snapshot, dispatch, stoppedEarly, getLog } = usePlayer(timeline, settings, {
    alertPlayer,
    clock,
  });
  const sessionRef = useRef<Promise<string> | null>(null);
  const [saved, setSaved] = useState<{ sessionId: string } | null | undefined>(undefined);

  useEffect(() => {
    dispatch('start');
    sessionRef.current = sessionService.start(workout, timeline);
  }, [dispatch, sessionService, workout, timeline]);

  const { phase, status, phaseIndex } = snapshot;
  const finished = status === 'finished';

  // Checkpoint a cada troca de fase: se o app fechar, a sessão fica registrada.
  useEffect(() => {
    if (finished || !sessionRef.current) return;
    void sessionRef.current.then((id) => sessionService.checkpoint(id, getLog()));
  }, [phaseIndex, finished, getLog, sessionService]);

  useEffect(() => {
    if (!finished || !sessionRef.current) return;
    let active = true;
    sessionRef.current
      .then((id) => sessionService.finish(id, getLog(), stoppedEarly))
      .then((result) => active && setSaved(result ? { sessionId: result.sessionId } : null));
    return () => {
      active = false;
    };
  }, [finished, getLog, sessionService, stoppedEarly]);
  const background = finished ? PhaseColors.finished : PhaseColors[phase?.kind ?? 'prepare'];

  const confirmStop = () =>
    Alert.alert('Parar treino?', 'O progresso deste treino será encerrado.', [
      { text: 'Continuar treinando', style: 'cancel' },
      { text: 'Parar', style: 'destructive', onPress: () => dispatch('stop') },
    ]);

  if (finished) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: background }]}>
        <View style={styles.center}>
          <ThemedText type="subtitle" style={styles.white} accessibilityRole="header">
            {stoppedEarly ? 'Treino interrompido' : 'Treino concluído!'}
          </ThemedText>
          <ThemedText style={styles.white}>
            Tempo: {formatDuration(snapshot.elapsedMs / 1000)} de{' '}
            {formatDuration(timeline.totalMs / 1000)}
          </ThemedText>
        </View>
        {saved ? (
          <Button
            title="Avaliar treino"
            onPress={() => router.replace(`/session/${saved.sessionId}/feedback`)}
            style={styles.mainBtn}
          />
        ) : null}
        <Button
          title="Concluir"
          variant={saved ? 'ghost' : 'primary'}
          onPress={() => router.back()}
          style={styles.mainBtn}
        />
      </SafeAreaView>
    );
  }

  const seconds = msToDisplaySeconds(snapshot.phaseRemainingMs);
  const paused = status === 'paused';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]}>
      <View style={styles.top}>
        <ThemedText type="smallBold" style={styles.white}>
          {workout.name}
        </ThemedText>
        <ThemedText type="small" style={styles.white}>
          Restante {formatClock(snapshot.totalRemainingMs / 1000)}
        </ThemedText>
      </View>
      <ProgressBar progress={snapshot.totalProgress} label="Progresso do treino" />

      <View style={styles.center}>
        <ThemedText type="smallBold" style={[styles.white, styles.phaseLabel]}>
          {paused ? 'PAUSADO' : phase ? PHASE_LABELS[phase.kind] : ''}
        </ThemedText>
        {phase && phase.kind === 'work' ? (
          <ThemedText type="subtitle" style={[styles.white, styles.centerText]}>
            {phase.label}
          </ThemedText>
        ) : null}
        <ThemedText
          style={[styles.white, styles.clock]}
          accessibilityLabel={`${seconds} segundos restantes`}
          accessibilityLiveRegion="polite">
          {formatClock(seconds)}
        </ThemedText>
        <View style={styles.phaseProgress}>
          <ProgressBar progress={snapshot.phaseProgress} label="Progresso da fase" />
        </View>
        {phase ? (
          <ThemedText type="small" style={styles.white}>
            {phase.cycleName} ({phase.cycleIndex + 1}/{phase.totalCycles}) · Exercício{' '}
            {phase.itemIndex + 1}/{phase.totalItems}
            {phase.totalRepeats > 1 ? ` · Repetição ${phase.repeat}/${phase.totalRepeats}` : ''}
          </ThemedText>
        ) : null}
        {phase?.nextWorkLabel ? (
          <ThemedText style={styles.white}>Próximo: {phase.nextWorkLabel}</ThemedText>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Button title="⏮ Voltar" variant="secondary" onPress={() => dispatch('back')} style={styles.ctrl} />
        <Button
          title={paused ? '▶ Continuar' : '⏸ Pausar'}
          onPress={() => dispatch(paused ? 'resume' : 'pause')}
          style={styles.ctrlMain}
        />
        <Button title="Pular ⏭" variant="secondary" onPress={() => dispatch('skip')} style={styles.ctrl} />
      </View>
      <Button title="Parar" variant="ghost" onPress={confirmStop} />
    </SafeAreaView>
  );
}

export function PlayerScreen({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const { workouts, soundService } = useServices();
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [settings, setSettings] = useState<AlertSettings | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const w = await workouts.getById(workoutId);
      const s = w ? await soundService.settingsForWorkout(w) : null;
      if (!active) return;
      setSettings(s);
      setWorkout(w);
    })();
    return () => {
      active = false;
    };
  }, [workoutId, workouts, soundService]);

  if (workout === undefined) return <Screen>{null}</Screen>;
  if (workout === null) {
    return (
      <Screen title="Treino não encontrado">
        <Button title="Voltar" onPress={() => router.back()} />
      </Screen>
    );
  }
  return settings ? <PlayerView workout={workout} settings={settings} /> : null;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.three },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.two },
  white: { color: WHITE },
  centerText: { textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  phaseLabel: { fontSize: 22, letterSpacing: 2 },
  clock: { fontSize: 112, lineHeight: 124, fontWeight: '700', fontVariant: ['tabular-nums'] },
  phaseProgress: { width: '80%' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: WHITE },
  controls: { flexDirection: 'row', gap: Spacing.two },
  ctrl: { flex: 1 },
  ctrlMain: { flex: 1.4 },
  mainBtn: { minHeight: 56 },
});
