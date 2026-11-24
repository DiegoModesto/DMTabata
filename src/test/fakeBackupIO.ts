import type { BackupIO, ShareOptions } from '@/services/backup/backupIO';

/** BackupIO falso: registra o que foi compartilhado e devolve textos configurados. */
export function createFakeBackupIO() {
  const state = {
    shared: [] as { fileName: string; content: string; options?: ShareOptions }[],
    nextPick: null as string | null,
    files: new Map<string, string>(),
  };
  const io: BackupIO = {
    async share(fileName, content, options) {
      state.shared.push({ fileName, content, options });
    },
    async pickText() {
      return state.nextPick;
    },
    async readUri(uri) {
      const text = state.files.get(uri);
      if (text === undefined) throw new Error(`arquivo não encontrado: ${uri}`);
      return text;
    },
  };
  return { io, state };
}
