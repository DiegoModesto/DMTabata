import { createMigratedTestDatabase } from '@/test/sqliteTestDatabase';

import { createSettingsRepository } from '../repositories/settingsRepository';

describe('settingsRepository', () => {
  it('grava, lê, sobrescreve e remove valores JSON', async () => {
    const settings = createSettingsRepository(await createMigratedTestDatabase());

    expect(await settings.get('x')).toBeNull();
    await settings.set('x', { a: 1 });
    expect(await settings.get('x')).toEqual({ a: 1 });
    await settings.set('x', 'outro');
    expect(await settings.get('x')).toBe('outro');
    await settings.remove('x');
    expect(await settings.get('x')).toBeNull();
  });
});
