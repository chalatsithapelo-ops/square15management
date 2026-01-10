export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  attachments?: {
    mimeType: string;
    data: string; // base64 encoded
  }[];
}
