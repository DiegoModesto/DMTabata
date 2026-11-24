import type { SqlDatabase } from './database';
import { migrations as defaultMigrations, type Migration } from './migrations';

export async function getSchemaVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Aplica, em ordem e dentro de transação, todas as migrações com versão maior
 * que a atual. Retorna as versões aplicadas.
 */
export async function migrate(
  db: SqlDatabase,
  migrations: Migration[] = defaultMigrations,
): Promise<number[]> {
  assertMigrationsAreValid(migrations);
  await db.execAsync('PRAGMA foreign_keys = ON');

  const current = await getSchemaVersion(db);
  const pending = migrations.filter((m) => m.version > current);
  const applied: number[] = [];

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      // PRAGMA não aceita parâmetro; versão é inteiro validado acima.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    applied.push(migration.version);
  }
  return applied;
}

export function assertMigrationsAreValid(migrations: Migration[]): void {
  migrations.forEach((m, index) => {
    if (!Number.isInteger(m.version) || m.version !== index + 1) {
      throw new Error(
        `Migração inválida: esperado versão ${index + 1}, recebido ${m.version} (${m.name}).`,
      );
    }
  });
}
