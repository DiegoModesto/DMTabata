import type { AlertSlot } from '@/domain/alerts';
import type { SoundConfig } from '@/domain/soundConfig';

import type { SqlDatabase } from '../database';

type ConfigRow = {
  id: string;
  name: string;
  prepare_start_sound_id: string | null;
  work_start_sound_id: string | null;
  rest_start_sound_id: string | null;
  countdown_sound_id: string | null;
  cycle_end_sound_id: string | null;
  workout_end_sound_id: string | null;
  halfway_sound_id: string | null;
  countdown_from: number | null;
  volume: number | null;
  voice_enabled: number | null;
  voice_lang: string | null;
  announce_next: number | null;
  haptics_enabled: number | null;
  halfway_alert: number | null;
  duck_music: number | null;
};

const SLOT_COLUMNS: Record<AlertSlot, keyof ConfigRow> = {
  prepareStart: 'prepare_start_sound_id',
  workStart: 'work_start_sound_id',
  restStart: 'rest_start_sound_id',
  countdown: 'countdown_sound_id',
  cycleEnd: 'cycle_end_sound_id',
  workoutEnd: 'workout_end_sound_id',
  halfway: 'halfway_sound_id',
};

const toBool = (v: number | null) => (v === null ? null : v === 1);
const fromBool = (v: boolean | null) => (v === null ? null : v ? 1 : 0);

function toConfig(row: ConfigRow): SoundConfig {
  return {
    id: row.id,
    name: row.name,
    sounds: Object.fromEntries(
      Object.entries(SLOT_COLUMNS).map(([slot, col]) => [slot, row[col] as string | null]),
    ) as SoundConfig['sounds'],
    countdownFrom: row.countdown_from,
    volume: row.volume,
    hapticsEnabled: toBool(row.haptics_enabled),
    halfwayAlert: toBool(row.halfway_alert),
    voiceEnabled: toBool(row.voice_enabled),
    voiceLang: row.voice_lang,
    announceNext: toBool(row.announce_next),
    duckMusic: toBool(row.duck_music),
  };
}

export function createSoundConfigRepository(db: SqlDatabase) {
  return {
    async getById(id: string): Promise<SoundConfig | null> {
      const row = await db.getFirstAsync<ConfigRow>('SELECT * FROM sound_configs WHERE id = ?', [
        id,
      ]);
      return row ? toConfig(row) : null;
    },

    async save(config: SoundConfig): Promise<void> {
      await db.runAsync(
        `INSERT INTO sound_configs (id, name, work_start_sound_id, rest_start_sound_id,
           countdown_sound_id, cycle_end_sound_id, workout_end_sound_id, halfway_sound_id,
           countdown_from, volume, voice_enabled, voice_lang, announce_next, haptics_enabled,
           halfway_alert, duck_music, prepare_start_sound_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           work_start_sound_id = excluded.work_start_sound_id,
           rest_start_sound_id = excluded.rest_start_sound_id,
           countdown_sound_id = excluded.countdown_sound_id,
           cycle_end_sound_id = excluded.cycle_end_sound_id,
           workout_end_sound_id = excluded.workout_end_sound_id,
           halfway_sound_id = excluded.halfway_sound_id,
           countdown_from = excluded.countdown_from,
           volume = excluded.volume,
           voice_enabled = excluded.voice_enabled,
           voice_lang = excluded.voice_lang,
           announce_next = excluded.announce_next,
           haptics_enabled = excluded.haptics_enabled,
           halfway_alert = excluded.halfway_alert,
           duck_music = excluded.duck_music,
           prepare_start_sound_id = excluded.prepare_start_sound_id`,
        [
          config.id,
          config.name,
          config.sounds.workStart,
          config.sounds.restStart,
          config.sounds.countdown,
          config.sounds.cycleEnd,
          config.sounds.workoutEnd,
          config.sounds.halfway,
          config.countdownFrom,
          config.volume,
          fromBool(config.voiceEnabled),
          config.voiceLang,
          fromBool(config.announceNext),
          fromBool(config.hapticsEnabled),
          fromBool(config.halfwayAlert),
          fromBool(config.duckMusic),
          config.sounds.prepareStart,
        ],
      );
    },

    async remove(id: string): Promise<void> {
      await db.runAsync('DELETE FROM sound_configs WHERE id = ?', [id]);
    },
  };
}

export type SoundConfigRepository = ReturnType<typeof createSoundConfigRepository>;
