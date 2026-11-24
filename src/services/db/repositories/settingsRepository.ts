import type { SqlDatabase } from '../database';

/** Armazenamento chave/valor simples (JSON) para preferências do app. */
export function createSettingsRepository(db: SqlDatabase) {
  return {
    async get<T>(key: string): Promise<T | null> {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        [key],
      );
      return row ? (JSON.parse(row.value) as T) : null;
    },

    async set<T>(key: string, value: T): Promise<void> {
      await db.runAsync(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, JSON.stringify(value)],
      );
    },

    async remove(key: string): Promise<void> {
      await db.runAsync('DELETE FROM app_settings WHERE key = ?', [key]);
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
