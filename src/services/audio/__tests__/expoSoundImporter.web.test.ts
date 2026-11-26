/**
 * Importador de sons da web: arquivos guardados no Cache Storage do navegador.
 * Globais do navegador (caches, URL.createObjectURL, fetch) são simulados.
 */
import { createExpoSoundImporter } from '../expoSoundImporter.web';

class FakeResponse {
  constructor(
    private body: unknown,
    public init?: { headers?: Record<string, string> },
  ) {}
  async blob() {
    return this.body;
  }
}

function installBrowserFakes() {
  const store = new Map<string, FakeResponse>();
  const cache = {
    put: async (key: string, response: FakeResponse) => void store.set(key, response),
    match: async (key: string) => store.get(key),
    delete: async (key: string) => store.delete(key),
  };
  const revoked: string[] = [];
  let n = 0;
  Object.assign(globalThis, {
    caches: { open: async () => cache },
    Response: FakeResponse,
    fetch: async (uri: string) => ({ blob: async () => ({ from: uri, type: 'audio/mp4' }) }),
  });
  Object.assign(globalThis.URL, {
    createObjectURL: () => `blob:url-${++n}`,
    revokeObjectURL: (url: string) => revoked.push(url),
  });
  return { store, revoked };
}

describe('expoSoundImporter (web)', () => {
  it('guarda o arquivo importado e o transforma em url tocável (uma só por som)', async () => {
    const { store } = installBrowserFakes();
    const importer = createExpoSoundImporter();
    const file = { type: 'audio/mpeg', name: 'grito.mp3' };
    const uri = await importer.persist(
      { fileName: 'grito.mp3', sizeBytes: 10, handle: file },
      'abc',
      'mp3',
    );
    expect(uri).toBe('/user-sounds/abc.mp3');
    expect(store.get(uri)?.init?.headers?.['Content-Type']).toBe('audio/mpeg');
    expect(await importer.resolve(uri)).toBe('blob:url-1');
    expect(await importer.resolve(uri)).toBe('blob:url-1');
  });

  it('gravação: copia o blob temporário e depois descarta a url temporária', async () => {
    const { store, revoked } = installBrowserFakes();
    const importer = createExpoSoundImporter();
    const uri = await importer.persistFile('blob:temp', 'rec1', 'm4a');
    expect(store.has(uri)).toBe(true);
    await importer.remove('blob:temp');
    expect(revoked).toEqual(['blob:temp']);
  });

  it('remover apaga do armazenamento e libera a url', async () => {
    const { store, revoked } = installBrowserFakes();
    const importer = createExpoSoundImporter();
    const uri = await importer.persistFile('blob:temp', 'x', 'mp3');
    const url = await importer.resolve(uri);
    await importer.remove(uri);
    expect(store.has(uri)).toBe(false);
    expect(revoked).toContain(url);
  });

  it('som que sumiu do armazenamento gera erro (o app segue sem ele)', async () => {
    installBrowserFakes();
    const importer = createExpoSoundImporter();
    await expect(importer.resolve('/user-sounds/nao-existe.mp3')).rejects.toThrow();
  });

  it('uris que não são do armazenamento passam direto', async () => {
    installBrowserFakes();
    const importer = createExpoSoundImporter();
    expect(await importer.resolve('https://exemplo/som.mp3')).toBe('https://exemplo/som.mp3');
  });
});
