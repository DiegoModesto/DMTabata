import type { PickedSound, SoundImporter } from '@/services/audio/soundImporter';

/** Importador falso: o próximo `pick()` devolve `nextPick`. */
export function createFakeSoundImporter() {
  const state = {
    nextPick: null as PickedSound | null,
    stored: new Map<string, PickedSound>(),
    removed: [] as string[],
    failPersist: false,
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
    async remove(uri) {
      state.removed.push(uri);
      state.stored.delete(uri);
    },
  };
  return { importer, state };
}
