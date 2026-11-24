import { Directory, File, Paths } from 'expo-file-system';

import type { PickedSound, SoundImporter } from './soundImporter';

const soundsDir = () => new Directory(Paths.document, 'sounds');

export function createExpoSoundImporter(): SoundImporter {
  return {
    async pick() {
      const result = await File.pickFileAsync({ mimeTypes: 'audio/*' });
      if (!result || result.canceled) return null;
      const file = result.result;
      return { fileName: file.name, sizeBytes: file.size ?? null, handle: file };
    },

    async persist(picked: PickedSound, soundId: string, extension: string) {
      const dir = soundsDir();
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const destination = new File(dir, `${soundId}.${extension}`);
      if (destination.exists) destination.delete();
      await (picked.handle as File).copy(destination);
      return destination.uri;
    },

    async remove(uri: string) {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
  };
}
