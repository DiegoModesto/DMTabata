import type { SqlDatabase } from './database';

export const GLOBAL_SOUND_CONFIG_ID = 'global';

/**
 * Dados iniciais idempotentes (podem rodar a cada abertura do app).
 * Os sons embutidos são registrados na fase de sons; aqui criamos a
 * configuração global com os valores padrão de alerta.
 */
export async function seed(db: SqlDatabase): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO sound_configs
      (id, name, countdown_from, volume, voice_enabled, voice_lang, announce_next,
       haptics_enabled, halfway_alert, duck_music)
     VALUES (?, ?, 3, 1.0, 0, 'pt-BR', 1, 1, 0, 1)`,
    [GLOBAL_SOUND_CONFIG_ID, 'Sons globais'],
  );
}
