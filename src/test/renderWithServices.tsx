import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ServicesContextProvider } from '@/providers/services-provider';
import { createServices, type ServiceOverrides, type Services } from '@/services/container';
import { seed } from '@/services/db/seed';

import { createMigratedTestDatabase } from './sqliteTestDatabase';

/** Cria serviços reais sobre um SQLite em memória (migrado e com seed). */
export async function createTestServices(overrides: ServiceOverrides = {}): Promise<Services> {
  const db = await createMigratedTestDatabase();
  await seed(db);
  // Sem treinos embutidos por padrão: os testes da biblioteca passam a lista explicitamente.
  const services = createServices(db, { bundledWorkouts: [], ...overrides });
  await services.authStore.getState().restore();
  return services;
}

export async function renderWithServices(ui: ReactElement, services?: Services) {
  const resolved = services ?? (await createTestServices());
  return {
    services: resolved,
    ...(await render(<ServicesContextProvider services={resolved}>{ui}</ServicesContextProvider>)),
  };
}
