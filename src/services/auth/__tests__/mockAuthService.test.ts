import { createSettingsRepository } from '@/services/db/repositories/settingsRepository';
import { createUserRepository } from '@/services/db/repositories/userRepository';
import { createMigratedTestDatabase } from '@/test/sqliteTestDatabase';

import { CURRENT_USER_KEY, createMockAuthService } from '../mockAuthService';

async function setup() {
  const db = await createMigratedTestDatabase();
  const users = createUserRepository(db);
  const settings = createSettingsRepository(db);
  return { auth: createMockAuthService({ users, settings }), users, settings };
}

describe('MockAuthService — regras de negócio do login simulado', () => {
  it('entra mesmo com campos vazios, criando o usuário padrão', async () => {
    const { auth } = await setup();
    const user = await auth.signIn({});
    expect(user.displayName).toBe('Atleta');
    expect(user.email).toBeNull();
    expect(await auth.currentUser()).toEqual(user);
  });

  it('qualquer senha é aceita', async () => {
    const { auth } = await setup();
    await expect(auth.signIn({ email: 'a@b.com', password: '' })).resolves.toBeDefined();
    await expect(auth.signIn({ email: 'a@b.com', password: 'xyz' })).resolves.toBeDefined();
  });

  it('reutiliza o mesmo usuário para o mesmo e-mail (normalizado)', async () => {
    const { auth } = await setup();
    const first = await auth.signIn({ email: 'Diego@Exemplo.com' });
    await auth.signOut();
    const second = await auth.signIn({ email: '  diego@exemplo.com ' });
    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe('Diego');
  });

  it('cria usuários diferentes para e-mails diferentes', async () => {
    const { auth } = await setup();
    const a = await auth.signIn({ email: 'a@x.com' });
    const b = await auth.signIn({ email: 'b@x.com' });
    expect(a.id).not.toBe(b.id);
    expect((await auth.currentUser())?.id).toBe(b.id);
  });

  it('sem e-mail, reutiliza o primeiro usuário local (dados não se perdem)', async () => {
    const { auth } = await setup();
    const first = await auth.signIn({ email: 'a@x.com' });
    await auth.signOut();
    expect((await auth.signIn({})).id).toBe(first.id);
  });

  it('sair limpa a sessão, mas mantém o usuário salvo', async () => {
    const { auth, users } = await setup();
    const user = await auth.signIn({ email: 'a@x.com' });
    await auth.signOut();
    expect(await auth.currentUser()).toBeNull();
    expect(await users.findById(user.id)).not.toBeNull();
  });

  it('limpa a sessão se o usuário salvo não existir mais', async () => {
    const { auth, settings } = await setup();
    await settings.set(CURRENT_USER_KEY, 'inexistente');
    expect(await auth.currentUser()).toBeNull();
    expect(await settings.get(CURRENT_USER_KEY)).toBeNull();
  });
});
