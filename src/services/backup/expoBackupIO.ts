import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { BackupIO } from './backupIO';

export function createExpoBackupIO(): BackupIO {
  return {
    async share(fileName, content, options) {
      const file = new File(Paths.cache, fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(content);
      await Sharing.shareAsync(file.uri, {
        mimeType: options?.mimeType ?? 'application/json',
        dialogTitle: options?.title ?? 'Exportar treinos',
        UTI: options?.uti ?? 'public.json',
      });
    },
    async pickText() {
      const result = await File.pickFileAsync({
        mimeTypes: ['application/json', 'application/x-dmtabata', 'text/*', '*/*'],
      });
      if (!result || result.canceled) return null;
      return result.result.text();
    },
    async readUri(uri) {
      return new File(uri).text();
    },
  };
}
