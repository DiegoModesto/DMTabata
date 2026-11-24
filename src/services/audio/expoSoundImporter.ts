import { Directory, File, Paths } from 'expo-file-system';

import type { PickedSound, SoundImporter } from './soundImporter';

const soundsDir = () => new Directory(Paths.document, 'sounds');

function prepareDestination(soundId: string, extension: string): File {
  const dir = soundsDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const destination = new File(dir, `${soundId}.${extension}`);
  if (destination.exists) destination.delete();
  return destination;
}

export function createExpoSoundImporter(): SoundImporter {
  return {
    async pick() {
      const result = await File.pickFileAsync({ mimeTypes: 'audio/*' });
      if (!result || result.canceled) return null;
      const file = result.result;
      return { fileName: file.name, sizeBytes: file.size ?? null, handle: file };
    },

    async persist(picked: PickedSound, soundId: string, extension: string) {
      const destination = prepareDestination(soundId, extension);
      await (picked.handle as File).copy(destination);
      return destination.uri;
    },

    async persistFile(sourceUri: string, soundId: string, extension: string) {
      const destination = prepareDestination(soundId, extension);
      await new File(sourceUri).copy(destination);
      return destination.uri;
    },

    async remove(uri: string) {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
  };
}
