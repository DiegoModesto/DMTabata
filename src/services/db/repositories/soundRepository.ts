import { createId } from '@/domain/id';
import type { SoundEntry, SoundSource } from '@/domain/sounds';

import type { SqlDatabase } from '../database';

type SoundRow = {
  id: string;
  name: string;
  source: SoundSource;
  uri: string;
  created_at: number;
};

const toEntry = (r: SoundRow): SoundEntry => ({
  id: r.id,
  name: r.name,
  source: r.source,
  uri: r.uri,
  createdAt: r.created_at,
});

export function createSoundRepository(db: SqlDatabase, now: () => number = Date.now) {
  return {
    /** Biblioteca completa: embutidos (ordem do catálogo) e depois os do usuário. */
    async list(): Promise<SoundEntry[]> {
      const rows = await db.getAllAsync<SoundRow>(
        `SELECT * FROM sounds WHERE id <> 'silent'
         ORDER BY CASE source WHEN 'builtin' THEN 0 ELSE 1 END, created_at, rowid`,
      );
      return rows.map(toEntry);
    },

    async getById(id: string): Promise<SoundEntry | null> {
      const row = await db.getFirstAsync<SoundRow>('SELECT * FROM sounds WHERE id = ?', [id]);
      return row ? toEntry(row) : null;
    },

    async addUserSound(input: { name: string; uri: string; id?: string }): Promise<SoundEntry> {
      const entry: SoundEntry = {
        id: input.id ?? createId(),
        name: input.name,
        source: 'user',
        uri: input.uri,
        createdAt: now(),
      };
      await db.runAsync(
        'INSERT INTO sounds (id, name, source, uri, created_at) VALUES (?, ?, ?, ?, ?)',
        [entry.id, entry.name, entry.source, entry.uri, entry.createdAt],
      );
      return entry;
    },

    async rename(id: string, name: string): Promise<void> {
      await db.runAsync("UPDATE sounds SET name = ? WHERE id = ? AND source = 'user'", [name, id]);
    },

    /**
     * Remove um som do usuário. Configurações e exercícios que o usavam passam a
     * herdar o som padrão (ON DELETE SET NULL). Sons embutidos não podem ser removidos.
     */
    async removeUserSound(id: string): Promise<SoundEntry | null> {
      const entry = await this.getById(id);
      if (!entry || entry.source !== 'user') return null;
      await db.runAsync('DELETE FROM sounds WHERE id = ?', [id]);
      return entry;
    },
  };
}

export type SoundRepository = ReturnType<typeof createSoundRepository>;
