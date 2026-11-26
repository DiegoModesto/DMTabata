import { pickBrowserFile } from '@/services/web/filePicker';

import type { PickedSound, SoundImporter } from './soundImporter';

/**
 * Sons do usuário na web: ficam no Cache Storage do navegador (mesma origem do app),
 * com chave `/user-sounds/<id>.<ext>`. Para tocar, viram uma `blob:` url.
 */
const CACHE_NAME = 'dmtabata-user-sounds';
const KEY_PREFIX = '/user-sounds/';

const keyFor = (soundId: string, extension: string) => `${KEY_PREFIX}${soundId}.${extension}`;
const isStoredKey = (uri: string) => uri.startsWith(KEY_PREFIX);

async function store(key: string, blob: Blob): Promise<string> {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    key,
    new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } }),
  );
  // Pede ao navegador para não apagar os dados do app sob pouca memória.
  void navigator.storage?.persist?.().catch(() => false);
  return key;
}

export function createExpoSoundImporter(): SoundImporter {
  const blobUrls = new Map<string, string>();

  return {
    async pick() {
      const file = await pickBrowserFile('audio/*');
      if (!file) return null;
      return { fileName: file.name, sizeBytes: file.size, handle: file };
    },

    persist: (picked: PickedSound, soundId: string, extension: string) =>
      store(keyFor(soundId, extension), picked.handle as Blob),

    async persistFile(sourceUri: string, soundId: string, extension: string) {
      const blob = await (await fetch(sourceUri)).blob();
      return store(keyFor(soundId, extension), blob);
    },

    async resolve(uri: string) {
      if (!isStoredKey(uri)) return uri;
      const cached = blobUrls.get(uri);
      if (cached) return cached;
      const response = await (await caches.open(CACHE_NAME)).match(uri);
      if (!response) throw new Error(`Som não encontrado: ${uri}`);
      const url = URL.createObjectURL(await response.blob());
      blobUrls.set(uri, url);
      return url;
    },

    async remove(uri: string) {
      if (uri.startsWith('blob:')) {
        URL.revokeObjectURL(uri);
        return;
      }
      if (!isStoredKey(uri)) return;
      const url = blobUrls.get(uri);
      if (url) URL.revokeObjectURL(url);
      blobUrls.delete(uri);
      await (await caches.open(CACHE_NAME)).delete(uri);
    },
  };
}
