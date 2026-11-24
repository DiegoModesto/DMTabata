import { createAuthStore } from '@/stores/authStore';

import { createMockAuthService } from './auth/mockAuthService';
import type { SqlDatabase } from './db/database';
import { createSettingsRepository } from './db/repositories/settingsRepository';
import { createUserRepository } from './db/repositories/userRepository';

/**
 * Composição das dependências do app (injeção manual).
 * Telas e stores recebem tudo por aqui — nos testes, basta montar com um banco de teste.
 */
export function createServices(db: SqlDatabase) {
  const settings = createSettingsRepository(db);
  const users = createUserRepository(db);
  const auth = createMockAuthService({ users, settings });
  const authStore = createAuthStore(auth);

  return { db, settings, users, auth, authStore };
}

export type Services = ReturnType<typeof createServices>;
