import Database from 'better-sqlite3';

import type { SqlDatabase, SqlValue } from '@/services/db/database';
import { migrate } from '@/services/db/migrate';

/**
 * Implementação de `SqlDatabase` sobre better-sqlite3 (em memória) para testes
 * de integração dos repositórios contra SQLite real.
 */
export function createTestDatabase(): SqlDatabase & { close(): void } {
  const raw = new Database(':memory:');
  let inTransaction = false;

  return {
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params: SqlValue[] = []) {
      const info = raw.prepare(sql).run(...params);
      return { changes: info.changes, lastInsertRowId: Number(info.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []) {
      const stmt = raw.prepare(sql);
      return (stmt.reader ? stmt.all(...params) : []) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
      const stmt = raw.prepare(sql);
      if (!stmt.reader) {
        stmt.run(...params);
        return null;
      }
      return (stmt.get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      if (inTransaction) {
        await task();
        return;
      }
      inTransaction = true;
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      } finally {
        inTransaction = false;
      }
    },
    close() {
      raw.close();
    },
  };
}

export async function createMigratedTestDatabase() {
  const db = createTestDatabase();
  await migrate(db);
  return db;
}
