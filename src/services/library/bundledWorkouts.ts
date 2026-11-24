/**
 * Treinos que vêm embutidos no app (arquivos em `assets/workouts/`).
 * Aparecem em "Modelos do DMTabata" e são adicionados uma vez à lista de treinos.
 * Para embutir um treino novo: compartilhe-o pelo app, salve o arquivo em
 * `assets/workouts/<id>.json` e registre aqui.
 */
export type BundledWorkout = { id: string; file: unknown };

export const BUNDLED_WORKOUTS: BundledWorkout[] = [
  { id: 'boxe-sequenciado', file: require('@/assets/workouts/boxe-sequenciado.json') },
];
