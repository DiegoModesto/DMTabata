import * as SQLite from 'expo-sqlite';

import type { SqlDatabase, SqlValue } from './database';

export const DATABASE_NAME = 'dmtabata.db';

/** Adapta o `SQLiteDatabase` do expo-sqlite ao contrato `SqlDatabase`. */
export function wrapExpoDatabase(db: SQLite.SQLiteDatabase): SqlDatabase {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params: SqlValue[] = []) => {
      const result = await db.runAsync(sql, params);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },
    getAllAsync: <T,>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T,>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

export async function openAppDatabase(): Promise<SqlDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return wrapExpoDatabase(db);
}
