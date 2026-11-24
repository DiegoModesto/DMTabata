import { SILENT_SOUND_ID } from '@/domain/alerts';
import { BUILTIN_SOUNDS, SILENT_SOUND_NAME } from '@/domain/sounds';

import type { SqlDatabase } from './database';

export const GLOBAL_SOUND_CONFIG_ID = 'global';

/**
 * Dados iniciais idempotentes (rodam a cada abertura do app).
 * - Sons embutidos (e o pseudo-som "silencioso") na biblioteca.
 * - Configuração global de sons: tudo `null` = usa o padrão do app.
 */
export async function seed(db: SqlDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const sounds = [{ id: SILENT_SOUND_ID, name: SILENT_SOUND_NAME }, ...BUILTIN_SOUNDS];
    for (const [index, sound] of sounds.entries()) {
      await db.runAsync(
        `INSERT INTO sounds (id, name, source, uri, created_at) VALUES (?, ?, 'builtin', ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, created_at = excluded.created_at`,
        [sound.id, sound.name, `builtin:${sound.id}`, index],
      );
    }
    await db.runAsync('INSERT OR IGNORE INTO sound_configs (id, name) VALUES (?, ?)', [
      GLOBAL_SOUND_CONFIG_ID,
      'Sons globais',
    ]);
  });
}
