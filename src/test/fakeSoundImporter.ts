import type { PickedSound, SoundImporter } from '@/services/audio/soundImporter';

/** Importador falso: o próximo `pick()` devolve `nextPick`. */
export function createFakeSoundImporter() {
  const state = {
    nextPick: null as PickedSound | null,
    stored: new Map<string, PickedSound | { sourceUri: string }>(),
    removed: [] as string[],
    failPersist: false,
    /** Simula a pasta do app em outro caminho (ex.: 'file:///novo/Documents/'). */
    documentDir: null as string | null,
  };
  const importer: SoundImporter = {
    async pick() {
      return state.nextPick;
    },
    async persist(picked, soundId, extension) {
      if (state.failPersist) throw new Error('disco cheio');
      const uri = `file:///sounds/${soundId}.${extension}`;
      state.stored.set(uri, picked);
      return uri;
    },
    async persistFile(sourceUri, soundId, extension) {
      if (state.failPersist) throw new Error('disco cheio');
      const uri = `file:///sounds/${soundId}.${extension}`;
      state.stored.set(uri, { sourceUri });
      return uri;
    },
    resolve: (uri) =>
      state.documentDir ? uri.replace(/^file:\/\/.*\/Documents\//, state.documentDir) : uri,
    async remove(uri) {
      state.removed.push(uri);
      state.stored.delete(uri);
    },
  };
  return { importer, state };
}
