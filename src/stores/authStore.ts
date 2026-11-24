import { createStore } from 'zustand/vanilla';

import type { User } from '@/domain/user';
import type { AuthService, SignInInput } from '@/services/auth/authService';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthState = {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  restore(): Promise<void>;
  signIn(input: SignInInput): Promise<void>;
  signOut(): Promise<void>;
};

export function createAuthStore(auth: AuthService) {
  return createStore<AuthState>()((set) => ({
    status: 'loading',
    user: null,
    error: null,

    async restore() {
      try {
        const user = await auth.currentUser();
        set({ user, status: user ? 'signedIn' : 'signedOut', error: null });
      } catch {
        set({ user: null, status: 'signedOut', error: null });
      }
    },

    async signIn(input) {
      try {
        const user = await auth.signIn(input);
        set({ user, status: 'signedIn', error: null });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Não foi possível entrar.' });
      }
    },

    async signOut() {
      await auth.signOut();
      set({ user: null, status: 'signedOut', error: null });
    },
  }));
}

export type AuthStore = ReturnType<typeof createAuthStore>;
