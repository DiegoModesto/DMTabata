import {
  ALERT_SLOTS,
  DEFAULT_ALERT_SETTINGS,
  SILENT_SOUND_ID,
  type AlertSettings,
  type AlertSlot,
  type SoundId,
} from './alerts';
import { cleanSurprisePool } from './surprises';

/**
 * Camada de configuração de alertas. Todo campo `null` significa "herdar da camada
 * de baixo". Camadas: padrão do app → global do usuário → treino.
 * (O exercício sobrescreve só os sons de início do trabalho/descanso — ver CycleItem.)
 */
export type SoundConfig = {
  id: string;
  name: string;
  sounds: Record<AlertSlot, SoundId | null>;
  countdownFrom: number | null;
  volume: number | null;
  hapticsEnabled: boolean | null;
  halfwayAlert: boolean | null;
  voiceEnabled: boolean | null;
  voiceLang: string | null;
  announceNext: boolean | null;
  duckMusic: boolean | null;
  /** `null` herda; `[]` desliga explicitamente. */
  surpriseSounds: SoundId[] | null;
  surpriseChance: number | null;
  /** `null` herda; `SILENT_SOUND_ID` = sem música. */
  backgroundMusicId: SoundId | null;
  musicVolume: number | null;
};

export const COUNTDOWN_MAX = 10;

export function emptySoundConfig(id: string, name: string): SoundConfig {
  return {
    id,
    name,
    sounds: Object.fromEntries(ALERT_SLOTS.map((slot) => [slot, null])) as Record<
      AlertSlot,
      SoundId | null
    >,
    countdownFrom: null,
    volume: null,
    hapticsEnabled: null,
    halfwayAlert: null,
    voiceEnabled: null,
    voiceLang: null,
    announceNext: null,
    duckMusic: null,
    surpriseSounds: null,
    surpriseChance: null,
    backgroundMusicId: null,
    musicVolume: null,
  };
}

const pick = <T>(value: T | null | undefined, fallback: T): T =>
  value === null || value === undefined ? fallback : value;

/** Aplica uma camada sobre configurações já resolvidas: campos `null` herdam de `base`. */
export function applySoundConfig(
  base: AlertSettings,
  layer: SoundConfig | null | undefined,
): AlertSettings {
  if (!layer) return base;
  const sounds = { ...base.sounds };
  for (const slot of ALERT_SLOTS) {
    const value = layer.sounds[slot];
    if (value !== null && value !== undefined) {
      sounds[slot] = value === SILENT_SOUND_ID ? null : value;
    }
  }
  return {
    sounds,
    countdownFrom: Math.min(
      COUNTDOWN_MAX,
      Math.max(0, pick(layer.countdownFrom, base.countdownFrom)),
    ),
    volume: Math.min(1, Math.max(0, pick(layer.volume, base.volume))),
    hapticsEnabled: pick(layer.hapticsEnabled, base.hapticsEnabled),
    halfwayAlert: pick(layer.halfwayAlert, base.halfwayAlert),
    voiceEnabled: pick(layer.voiceEnabled, base.voiceEnabled),
    voiceLang: pick(layer.voiceLang, base.voiceLang),
    announceNext: pick(layer.announceNext, base.announceNext),
    duckMusic: pick(layer.duckMusic, base.duckMusic),
    surpriseSounds: cleanSurprisePool(pick(layer.surpriseSounds, base.surpriseSounds)),
    surpriseChance: Math.min(1, Math.max(0, pick(layer.surpriseChance, base.surpriseChance))),
    backgroundMusicId:
      layer.backgroundMusicId === null || layer.backgroundMusicId === undefined
        ? base.backgroundMusicId
        : layer.backgroundMusicId === SILENT_SOUND_ID
          ? null
          : layer.backgroundMusicId,
    musicVolume: Math.min(1, Math.max(0, pick(layer.musicVolume, base.musicVolume))),
  };
}

/** Aplica as camadas em ordem (a última vence) sobre o padrão do app. */
export function resolveAlertSettings(...layers: (SoundConfig | null | undefined)[]): AlertSettings {
  return layers.reduce<AlertSettings>(applySoundConfig, DEFAULT_ALERT_SETTINGS);
}

/** Todos os sons que podem tocar com estas configurações (para pré-carregar). */
export function soundsInUse(settings: AlertSettings, extra: (SoundId | null)[] = []): SoundId[] {
  const ids = [
    ...ALERT_SLOTS.map((slot) => settings.sounds[slot]),
    ...settings.surpriseSounds,
    settings.backgroundMusicId,
    ...extra,
  ];
  return [...new Set(ids.filter((id): id is SoundId => !!id && id !== SILENT_SOUND_ID))];
}

/** Algum campo desta camada sobrescreve a anterior? */
export function hasOverrides(config: SoundConfig): boolean {
  const { id: _id, name: _name, sounds, ...rest } = config;
  return (
    Object.values(sounds).some((v) => v !== null) || Object.values(rest).some((v) => v !== null)
  );
}
