export interface IncomingMessage {
  chatId: number;
  username?: string | null;
  displayName?: string | null;
  text: string;
  source: 'text' | 'voice';
}
