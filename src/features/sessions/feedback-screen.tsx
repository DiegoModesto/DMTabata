import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chips } from '@/components/ui/chips';
import { Screen } from '@/components/ui/screen';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/domain/format';
import {
  completionRate,
  DIFFICULTY_LABELS,
  FEEDBACK_LIMITS,
  MOOD_LABELS,
  sessionDurationSec,
  type Difficulty,
  type Feedback,
  type Mood,
  type SessionRecord,
} from '@/domain/stats';
import { useServices } from '@/providers/services-provider';

import { formatPercent, statusLabel } from '../stats/format';

const EMPTY: Feedback = { rating: null, rpe: null, difficulty: null, mood: null, notes: null };
const RATINGS = ['1', '2', '3', '4', '5'] as const;

/** Resumo pós-treino + feedback (nota, esforço, dificuldade, humor, observações). */
export function FeedbackScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { sessionService } = useServices();
  const [session, setSession] = useState<SessionRecord | null | undefined>(undefined);
  const [feedback, setFeedback] = useState<Feedback>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    sessionService.getSession(sessionId).then((s) => {
      if (!active) return;
      setSession(s);
      if (s?.feedback) setFeedback(s.feedback);
    });
    return () => {
      active = false;
    };
  }, [sessionId, sessionService]);

  if (session === undefined) return <Screen title="Como foi o treino?">{null}</Screen>;
  if (session === null) {
    return (
      <Screen title="Sessão não encontrada">
        <Button title="Voltar" onPress={() => router.back()} />
      </Screen>
    );
  }

  const next = () =>
    session.workoutId ? router.replace(`/workout/${session.workoutId}/stats`) : router.back();

  const save = async () => {
    setSaving(true);
    try {
      const problems = await sessionService.saveFeedback(sessionId, feedback);
      setErrors(problems);
      if (problems.length === 0) next();
    } finally {
      setSaving(false);
    }
  };

  const set = (changes: Partial<Feedback>) => setFeedback((f) => ({ ...f, ...changes }));

  return (
    <Screen title="Como foi o treino?" scroll>
      <Card>
        <ThemedText type="smallBold">{session.workoutName}</ThemedText>
        <ThemedText>
          {statusLabel(session)} · {formatPercent(completionRate(session))} concluído
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Tempo realizado {formatDuration(sessionDurationSec(session))} de{' '}
          {formatDuration(session.plannedSec)}
          {session.pausedSec > 0 ? ` · pausado ${formatDuration(session.pausedSec)}` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Trabalho {formatDuration(session.workSec)} · Descanso {formatDuration(session.restSec)} ·{' '}
          {session.phasesCompleted}/{session.phasesTotal} fases
          {session.phasesSkipped ? ` · ${session.phasesSkipped} puladas` : ''}
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="smallBold">Nota</ThemedText>
        <Chips
          label="Nota"
          options={RATINGS.map((r) => ({ value: r, label: `${r} ★` }))}
          value={feedback.rating ? (String(feedback.rating) as (typeof RATINGS)[number]) : null}
          onChange={(v) => set({ rating: v ? Number(v) : null })}
          allowDeselect
        />
        <Stepper
          label="Esforço percebido (1–10)"
          format="count"
          step={1}
          min={FEEDBACK_LIMITS.rpe[0]}
          max={FEEDBACK_LIMITS.rpe[1]}
          value={feedback.rpe ?? 5}
          highlighted={feedback.rpe !== null}
          onChange={(rpe) => set({ rpe })}
        />
        <ThemedText type="smallBold">Dificuldade</ThemedText>
        <Chips<Difficulty>
          label="Dificuldade"
          options={(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((value) => ({
            value,
            label: DIFFICULTY_LABELS[value],
          }))}
          value={feedback.difficulty}
          onChange={(difficulty) => set({ difficulty })}
          allowDeselect
        />
        <ThemedText type="smallBold">Como você se sentiu?</ThemedText>
        <Chips<Mood>
          label="Humor"
          options={(Object.keys(MOOD_LABELS) as Mood[]).map((value) => ({
            value,
            label: MOOD_LABELS[value],
          }))}
          value={feedback.mood}
          onChange={(mood) => set({ mood })}
          allowDeselect
        />
        <TextField
          label="Observações"
          placeholder="Ex.: aumentar o descanso da prancha"
          value={feedback.notes ?? ''}
          onChangeText={(notes) => set({ notes })}
          maxLength={FEEDBACK_LIMITS.notesMaxLength}
          multiline
        />
      </Card>

      {errors.map((e) => (
        <ThemedText key={e} type="small" themeColor="danger">
          • {e}
        </ThemedText>
      ))}

      <View style={styles.actions}>
        <Button title="Pular" variant="ghost" onPress={next} style={styles.flex} />
        <Button title="Salvar" onPress={save} loading={saving} style={styles.flex} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
