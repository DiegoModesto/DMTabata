/** Arquivo escolhido pelo usuário, ainda não copiado para o app. */
export type PickedSound = {
  fileName: string;
  sizeBytes: number | null;
  /** Referência opaca usada para copiar o arquivo. */
  handle: unknown;
};

/** Seleção e armazenamento de sons importados. Implementação real: expo-file-system. */
export interface SoundImporter {
  pick(): Promise<PickedSound | null>;
  /** Copia o arquivo para o diretório do app e devolve a uri definitiva. */
  persist(picked: PickedSound, soundId: string, extension: string): Promise<string>;
  remove(uri: string): Promise<void>;
}
