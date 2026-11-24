import { displayNameFromEmail, normalizeEmail } from '@/domain/user';
import type { SettingsRepository } from '@/services/db/repositories/settingsRepository';
import type { UserRepository } from '@/services/db/repositories/userRepository';

import type { AuthService } from './authService';

export const CURRENT_USER_KEY = 'auth.currentUserId';

/**
 * Login simulado: qualquer combinação (inclusive campos vazios) entra no app.
 * - Com e-mail: reutiliza o usuário com o mesmo e-mail ou cria um novo.
 * - Sem e-mail: reutiliza o primeiro usuário local ou cria "Atleta".
 */
export function createMockAuthService(deps: {
  users: UserRepository;
  settings: SettingsRepository;
}): AuthService {
  const { users, settings } = deps;

  return {
    async signIn({ email }) {
      const normalized = normalizeEmail(email);
      const existing = normalized ? await users.findByEmail(normalized) : await users.findFirst();
      const user =
        existing ??
        (await users.create({ displayName: displayNameFromEmail(normalized), email: normalized }));
      await settings.set(CURRENT_USER_KEY, user.id);
      return user;
    },

    async signOut() {
      await settings.remove(CURRENT_USER_KEY);
    },

    async currentUser() {
      const id = await settings.get<string>(CURRENT_USER_KEY);
      if (!id) return null;
      const user = await users.findById(id);
      if (!user) await settings.remove(CURRENT_USER_KEY);
      return user;
    },
  };
}
