export type ShareOptions = { mimeType?: string; uti?: string; title?: string };

/** Entrada/saída de arquivos de backup. Implementação real: expo-file-system + expo-sharing. */
export interface BackupIO {
  /** Grava o conteúdo e abre a folha de compartilhamento do sistema. */
  share(fileName: string, content: string, options?: ShareOptions): Promise<void>;
  /** Escolhe um arquivo e devolve o texto, ou null se cancelado. */
  pickText(): Promise<string | null>;
  /** Lê um arquivo recebido de outro app (ex.: treino aberto pelo WhatsApp). */
  readUri(uri: string): Promise<string>;
}
