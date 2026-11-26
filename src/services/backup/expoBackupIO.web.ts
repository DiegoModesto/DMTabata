import { pickBrowserFile } from '@/services/web/filePicker';

import type { BackupIO } from './backupIO';

/** Baixa o arquivo pelo navegador (quando não há folha de compartilhamento). */
function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Arquivos na web: compartilha pelo menu do sistema (Web Share, no celular)
 * ou baixa o arquivo; importa pelo seletor de arquivos do navegador.
 */
export function createExpoBackupIO(): BackupIO {
  return {
    async share(fileName, content, options) {
      const file = new File([content], fileName, {
        type: options?.mimeType ?? 'application/json',
      });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: options?.title ?? fileName });
          return;
        } catch (error) {
          if ((error as Error)?.name === 'AbortError') return; // usuário fechou o menu
          // outro erro: cai no download
        }
      }
      download(file);
    },
    async pickText() {
      const file = await pickBrowserFile('.json,.dmtabata,application/json,text/*');
      return file ? file.text() : null;
    },
    async readUri(uri) {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`Não foi possível ler ${uri}`);
      return response.text();
    },
  };
}
