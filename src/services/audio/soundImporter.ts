/** Arquivo escolhido pelo usuário, ainda não copiado para o app. */
export type PickedSound = {
  fileName: string;
  sizeBytes: number | null;
  /** Referência opaca usada para copiar o arquivo. */
  handle: unknown;
};

/** Seleção e armazenamento de sons importados. Implementações: expo-file-system (nativo) e Cache Storage (web). */
export interface SoundImporter {
  pick(): Promise<PickedSound | null>;
  /** Copia o arquivo para o diretório do app e devolve a uri definitiva. */
  persist(picked: PickedSound, soundId: string, extension: string): Promise<string>;
  /** Copia um arquivo já local (ex.: gravação temporária) para o diretório do app. */
  persistFile(sourceUri: string, soundId: string, extension: string): Promise<string>;
  remove(uri: string): Promise<void>;
  /**
   * Uri salva → uri tocável agora (no iOS a pasta do app pode mudar de caminho;
   * na web o arquivo vem do armazenamento local e vira uma `blob:` url).
   */
  resolve(uri: string): string | Promise<string>;
}
