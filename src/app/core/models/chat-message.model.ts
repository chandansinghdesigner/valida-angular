export interface ChatMessage {
  id: string;
  sender: 'proctor' | 'candidate';
  senderName: string;
  text: string;
  timestamp: Date;
}
