import { createTestDatabase } from '@/test/sqliteTestDatabase';

import { assertMigrationsAreValid, getSchemaVersion, migrate } from '../migrate';
import { migrations } from '../migrations';
import { GLOBAL_SOUND_CONFIG_ID, seed } from '../seed';

describe('migrate', () => {
  it('aplica todas as migrações em um banco novo e registra a versão', async () => {
    const db = createTestDatabase();
    const applied = await migrate(db);

    expect(applied).toEqual(migrations.map((m) => m.version));
    expect(await getSchemaVersion(db)).toBe(migrations.length);

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'app_settings',
        'users',
        'workouts',
        'cycles',
        'cycle_items',
        'sounds',
        'sound_configs',
        'sessions',
        'session_phases',
        'session_feedback',
      ]),
    );
  });

  it('é idempotente: rodar de novo não aplica nada', async () => {
    const db = createTestDatabase();
    await migrate(db);
    expect(await migrate(db)).toEqual([]);
  });

  it('aplica apenas migrações pendentes', async () => {
    const db = createTestDatabase();
    const v1 = { version: 1, name: 'a', sql: 'CREATE TABLE a (id INTEGER);' };
    const v2 = { version: 2, name: 'b', sql: 'CREATE TABLE b (id INTEGER);' };
    await migrate(db, [v1]);
    expect(await migrate(db, [v1, v2])).toEqual([2]);
    expect(await getSchemaVersion(db)).toBe(2);
  });

  it('desfaz a migração inteira se ela falhar', async () => {
    const db = createTestDatabase();
    const broken = {
      version: 1,
      name: 'quebrada',
      sql: 'CREATE TABLE ok (id INTEGER); CREATE TABLE ok (id INTEGER);',
    };
    await expect(migrate(db, [broken])).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(0);
    const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE name = 'ok'");
    expect(tables).toHaveLength(0);
  });

  it('ativa foreign keys (exclusão em cascata funciona)', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await db.runAsync(
      "INSERT INTO workouts (id, name, created_at, updated_at) VALUES ('w1', 'Treino', 0, 0)",
    );
    await db.runAsync(
      "INSERT INTO cycles (id, workout_id, position, name, default_work_sec, default_rest_sec) VALUES ('c1', 'w1', 0, 'Ciclo', 30, 10)",
    );
    await db.runAsync("DELETE FROM workouts WHERE id = 'w1'");
    expect(await db.getAllAsync('SELECT * FROM cycles')).toHaveLength(0);
  });
});

describe('assertMigrationsAreValid', () => {
  it('exige versões sequenciais começando em 1', () => {
    expect(() => assertMigrationsAreValid([{ version: 2, name: 'x', sql: '' }])).toThrow(
      /esperado versão 1/,
    );
    expect(() =>
      assertMigrationsAreValid([
        { version: 1, name: 'a', sql: '' },
        { version: 3, name: 'b', sql: '' },
      ]),
    ).toThrow(/esperado versão 2/);
  });

  it('as migrações reais são válidas', () => {
    expect(() => assertMigrationsAreValid(migrations)).not.toThrow();
  });
});

describe('seed', () => {
  it('cria a configuração global de sons e pode rodar várias vezes', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await seed(db);
    await seed(db);
    const rows = await db.getAllAsync<{ id: string; countdown_from: number }>(
      'SELECT id, countdown_from FROM sound_configs',
    );
    expect(rows).toEqual([{ id: GLOBAL_SOUND_CONFIG_ID, countdown_from: 3 }]);
  });
});
