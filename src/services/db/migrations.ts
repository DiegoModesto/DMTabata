/**
 * Migrações versionadas. Cada item é aplicado uma única vez, em ordem,
 * e a versão corrente fica em `PRAGMA user_version`.
 *
 * Regra: nunca editar uma migração já publicada — sempre adicionar uma nova.
 */
export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'schema inicial',
    sql: `
      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE exercises (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        icon TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE sounds (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('builtin', 'user')),
        uri TEXT NOT NULL,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE sound_configs (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        work_start_sound_id TEXT REFERENCES sounds(id) ON DELETE SET NULL,
        rest_start_sound_id TEXT REFERENCES sounds(id) ON DELETE SET NULL,
        countdown_sound_id TEXT REFERENCES sounds(id) ON DELETE SET NULL,
        cycle_end_sound_id TEXT REFERENCES sounds(id) ON DELETE SET NULL,
        workout_end_sound_id TEXT REFERENCES sounds(id) ON DELETE SET NULL,
        countdown_from INTEGER,
        volume REAL,
        voice_enabled INTEGER,
        voice_lang TEXT,
        announce_next INTEGER,
        haptics_enabled INTEGER,
        halfway_alert INTEGER,
        duck_music INTEGER
      );

      CREATE TABLE workouts (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'custom',
        prepare_sec INTEGER NOT NULL DEFAULT 10,
        cooldown_sec INTEGER NOT NULL DEFAULT 0,
        rest_between_cycles_sec INTEGER NOT NULL DEFAULT 60,
        sound_config_id TEXT REFERENCES sound_configs(id) ON DELETE SET NULL,
        color TEXT,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE cycles (
        id TEXT PRIMARY KEY NOT NULL,
        workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        name TEXT NOT NULL,
        repeat_count INTEGER NOT NULL DEFAULT 1,
        default_work_sec INTEGER NOT NULL,
        default_rest_sec INTEGER NOT NULL,
        skip_last_rest INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX idx_cycles_workout ON cycles(workout_id, position);

      CREATE TABLE cycle_items (
        id TEXT PRIMARY KEY NOT NULL,
        cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
        label TEXT,
        work_sec INTEGER,
        rest_sec INTEGER,
        sound_config_id TEXT REFERENCES sound_configs(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_cycle_items_cycle ON cycle_items(cycle_id, position);

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY NOT NULL,
        workout_id TEXT REFERENCES workouts(id) ON DELETE SET NULL,
        workout_snapshot TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')),
        planned_total_sec INTEGER NOT NULL,
        actual_work_sec INTEGER NOT NULL DEFAULT 0,
        actual_rest_sec INTEGER NOT NULL DEFAULT 0,
        paused_sec INTEGER NOT NULL DEFAULT 0,
        phases_completed INTEGER NOT NULL DEFAULT 0,
        phases_skipped INTEGER NOT NULL DEFAULT 0,
        phases_total INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_sessions_workout ON sessions(workout_id, started_at);

      CREATE TABLE session_phases (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        phase_index INTEGER NOT NULL,
        kind TEXT NOT NULL,
        cycle_position INTEGER,
        item_position INTEGER,
        exercise_label TEXT,
        planned_ms INTEGER NOT NULL,
        actual_ms INTEGER NOT NULL,
        skipped INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_session_phases_session ON session_phases(session_id, phase_index);

      CREATE TABLE session_feedback (
        session_id TEXT PRIMARY KEY NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
        mood TEXT,
        difficulty TEXT,
        notes TEXT
      );
    `,
  },
  {
    version: 2,
    name: 'sons por exercício e som de metade',
    sql: `
      ALTER TABLE sound_configs ADD COLUMN halfway_sound_id TEXT
        REFERENCES sounds(id) ON DELETE SET NULL;
      ALTER TABLE cycle_items ADD COLUMN work_sound_id TEXT
        REFERENCES sounds(id) ON DELETE SET NULL;
      ALTER TABLE cycle_items ADD COLUMN rest_sound_id TEXT
        REFERENCES sounds(id) ON DELETE SET NULL;
    `,
  },
];
