import { importRouteForPath } from '@/domain/workoutFile';

/** Arquivos `.dmtabata` abertos de outros apps vão para a tela de importar treino. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return importRouteForPath(path) ?? path;
  } catch {
    return path;
  }
}
