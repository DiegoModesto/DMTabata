/**
 * Contrato mínimo de banco usado pelos repositórios.
 *
 * No app é implementado sobre `expo-sqlite` (ver `expoDatabase.ts`); nos testes,
 * sobre `better-sqlite3` (ver `src/test/sqliteTestDatabase.ts`). Assim os
 * repositórios são testados contra SQLite de verdade, sem depender do runtime nativo.
 */
export type SqlValue = string | number | null;

export type RunResult = {
  changes: number;
  lastInsertRowId: number;
};

export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlValue[]): Promise<RunResult>;
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
