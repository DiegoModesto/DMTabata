import type { AuthService } from '@/services/auth/authService';

import { createAuthStore } from '../authStore';

const user = { id: 'u1', displayName: 'Atleta', email: null, createdAt: 0 };

function fakeAuth(overrides: Partial<AuthService> = {}): AuthService {
  return {
    signIn: jest.fn().mockResolvedValue(user),
    signOut: jest.fn().mockResolvedValue(undefined),
    currentUser: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('authStore', () => {
  it('começa carregando', () => {
    expect(createAuthStore(fakeAuth()).getState().status).toBe('loading');
  });

  it('restore: sem sessão → signedOut', async () => {
    const store = createAuthStore(fakeAuth());
    await store.getState().restore();
    expect(store.getState()).toMatchObject({ status: 'signedOut', user: null });
  });

  it('restore: com sessão → signedIn', async () => {
    const store = createAuthStore(fakeAuth({ currentUser: jest.fn().mockResolvedValue(user) }));
    await store.getState().restore();
    expect(store.getState()).toMatchObject({ status: 'signedIn', user });
  });

  it('restore: erro ao ler sessão → signedOut (não trava o app)', async () => {
    const store = createAuthStore(
      fakeAuth({ currentUser: jest.fn().mockRejectedValue(new Error('db')) }),
    );
    await store.getState().restore();
    expect(store.getState().status).toBe('signedOut');
  });

  it('signIn e signOut atualizam o estado', async () => {
    const auth = fakeAuth();
    const store = createAuthStore(auth);
    await store.getState().signIn({ email: 'a@b.com' });
    expect(auth.signIn).toHaveBeenCalledWith({ email: 'a@b.com' });
    expect(store.getState()).toMatchObject({ status: 'signedIn', user });
    await store.getState().signOut();
    expect(store.getState()).toMatchObject({ status: 'signedOut', user: null });
  });

  it('signIn com falha expõe a mensagem de erro', async () => {
    const store = createAuthStore(
      fakeAuth({ signIn: jest.fn().mockRejectedValue(new Error('Falhou')) }),
    );
    await store.getState().restore();
    await store.getState().signIn({});
    expect(store.getState()).toMatchObject({ status: 'signedOut', error: 'Falhou' });
  });
});
