/** Entrada/saída de arquivos de backup. Implementação real: expo-file-system + expo-sharing. */
export interface BackupIO {
  /** Grava o conteúdo e abre a folha de compartilhamento do sistema. */
  share(fileName: string, content: string): Promise<void>;
  /** Escolhe um arquivo e devolve o texto, ou null se cancelado. */
  pickText(): Promise<string | null>;
}
