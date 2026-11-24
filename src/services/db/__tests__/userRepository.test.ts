import { createMigratedTestDatabase } from '@/test/sqliteTestDatabase';

import { createUserRepository } from '../repositories/userRepository';

describe('userRepository', () => {
  it('cria e encontra usuários por id e e-mail (sem diferenciar maiúsculas)', async () => {
    const users = createUserRepository(await createMigratedTestDatabase(), () => 1000);
    const created = await users.create({ displayName: 'Diego', email: 'diego@x.com' });

    expect(created).toMatchObject({ displayName: 'Diego', email: 'diego@x.com', createdAt: 1000 });
    expect(await users.findById(created.id)).toEqual(created);
    expect(await users.findByEmail('DIEGO@X.COM')).toEqual(created);
    expect(await users.findByEmail('outro@x.com')).toBeNull();
  });

  it('findFirst retorna o usuário mais antigo', async () => {
    let clock = 0;
    const users = createUserRepository(await createMigratedTestDatabase(), () => ++clock);
    expect(await users.findFirst()).toBeNull();
    const first = await users.create({ displayName: 'A', email: null });
    await users.create({ displayName: 'B', email: null });
    expect((await users.findFirst())?.id).toBe(first.id);
  });
});
