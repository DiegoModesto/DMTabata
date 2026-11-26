/** Mensagem amigável quando o app não consegue abrir o banco local. */
export type StartupProblem = { title: string; message: string; canRetry: boolean };

const text = (error: unknown) =>
  error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');

export function describeStartupError(error: unknown): StartupProblem {
  const raw = text(error);
  // Na web o banco (SQLite no armazenamento do navegador) só abre em uma aba por vez.
  if (
    /createSyncAccessHandle|Access Handles? cannot be created|NoModificationAllowedError/i.test(raw)
  ) {
    return {
      title: 'O DMTabata já está aberto',
      message: 'Ele está aberto em outra aba ou janela. Feche a outra e toque em "Tentar de novo".',
      canRetry: true,
    };
  }
  if (/SharedArrayBuffer|crossOriginIsolated|OPFS|getDirectory/i.test(raw)) {
    return {
      title: 'Navegador sem suporte',
      message:
        'Este navegador não permite guardar os treinos no aparelho. Use uma versão recente do Safari, Chrome, Edge ou Firefox.',
      canRetry: false,
    };
  }
  return {
    title: 'Não foi possível abrir o app',
    message: 'Os seus dados não foram alterados. Tente abrir de novo.',
    canRetry: true,
  };
}
