import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { createServices, type ServiceOverrides, type Services } from '@/services/container';
import type { SqlDatabase } from '@/services/db/database';
import { migrate } from '@/services/db/migrate';
import { seed } from '@/services/db/seed';
import type { AuthState } from '@/stores/authStore';
import type { WorkoutsState } from '@/stores/workoutsStore';

const ServicesContext = createContext<Services | null>(null);

type Props = {
  openDatabase: () => Promise<SqlDatabase>;
  createOverrides?: () => ServiceOverrides;
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: unknown) => void;
};

/** Abre o banco, aplica migrações/seeds e expõe os serviços para a árvore. */
export function ServicesProvider({
  openDatabase,
  createOverrides,
  children,
  fallback = null,
  onError,
}: Props) {
  const [services, setServices] = useState<Services | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await openDatabase();
        await migrate(db);
        await seed(db);
        const created = createServices(db, createOverrides?.());
        await created.authStore.getState().restore();
        await created.soundService.registerUserSources();
        if (!cancelled) setServices(created);
      } catch (error) {
        onError?.(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openDatabase, createOverrides, onError]);

  if (!services) return <>{fallback}</>;
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

/** Permite injetar serviços prontos (testes). */
export function ServicesContextProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices deve ser usado dentro de <ServicesProvider>.');
  return services;
}

export function useAuth<T>(selector: (state: AuthState) => T): T {
  return useStore(useServices().authStore, selector);
}

export function useWorkouts<T>(selector: (state: WorkoutsState) => T): T {
  return useStore(useServices().workoutsStore, selector);
}
