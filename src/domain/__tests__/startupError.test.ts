import { describeStartupError } from '../startupError';

describe('describeStartupError', () => {
  it('banco já aberto em outra aba do navegador', () => {
    const error = new Error(
      "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle",
    );
    expect(describeStartupError(error)).toMatchObject({
      title: 'O DMTabata já está aberto',
      canRetry: true,
    });
  });

  it('navegador sem SharedArrayBuffer não tem como tentar de novo', () => {
    const error = new ReferenceError('SharedArrayBuffer is not defined');
    expect(describeStartupError(error)).toMatchObject({
      title: 'Navegador sem suporte',
      canRetry: false,
    });
  });

  it('Safari em navegação privada pede para abrir numa aba normal', () => {
    const error = new Error(
      'The operation failed for an unknown transient reason (e.g. out of memory).',
    );
    expect(describeStartupError(error)).toMatchObject({
      title: 'Abra fora da navegação privada',
      canRetry: true,
    });
  });

  it('outros erros: mensagem genérica, com nova tentativa', () => {
    expect(describeStartupError('boom')).toMatchObject({
      title: 'Não foi possível abrir o app',
      canRetry: true,
    });
    expect(describeStartupError(undefined).canRetry).toBe(true);
  });
});
