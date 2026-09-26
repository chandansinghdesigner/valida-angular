import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ChatMessage } from '../models/chat-message.model';

export type HubConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private hubConnection: signalR.HubConnection | null = null;

  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  readonly messages$ = this.messagesSubject.asObservable();

  /** Fires once per newly received message — used to trigger sound/visual alerts. */
  readonly incomingMessage$ = new Subject<ChatMessage>();

  private statusSubject = new BehaviorSubject<HubConnectionStatus>('disconnected');
  readonly status$ = this.statusSubject.asObservable();

  constructor(private auth: AuthService) {}

  /** Opens the SignalR connection for a given exam/session room. */
  async connect(sessionId: string): Promise<void> {
    if (this.hubConnection) {
      await this.disconnect();
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.chatHubUrl, {
        accessTokenFactory: () => this.auth.getToken() ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.hubConnection.onreconnecting(() => this.statusSubject.next('reconnecting'));
    this.hubConnection.onreconnected(() => this.statusSubject.next('connected'));
    this.hubConnection.onclose(() => this.statusSubject.next('disconnected'));

    // Server -> client: "ReceiveMessage" pushes a new chat message.
    this.hubConnection.on('ReceiveMessage', (payload: Omit<ChatMessage, 'timestamp'> & { timestamp: string }) => {
      const message: ChatMessage = { ...payload, timestamp: new Date(payload.timestamp) };
      this.messagesSubject.next([...this.messagesSubject.value, message]);
      this.incomingMessage$.next(message);
    });

    this.statusSubject.next('connecting');
    try {
      await this.hubConnection.start();
      await this.hubConnection.invoke('JoinSession', sessionId);
      this.statusSubject.next('connected');
    } catch (err) {
      this.statusSubject.next('disconnected');
      throw err;
    }
  }

  /** Client -> server: broadcasts a message to everyone in the session room. */
  async sendMessage(sessionId: string, text: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Chat is not connected.');
    }
    await this.hubConnection.invoke('SendMessage', sessionId, text);
  }

  /** Convenience wrapper matching the required receiveMessage() naming. */
  receiveMessage(handler: (message: ChatMessage) => void): void {
    this.incomingMessage$.subscribe(handler);
  }

  async disconnect(): Promise<void> {
    await this.hubConnection?.stop();
    this.hubConnection = null;
    this.messagesSubject.next([]);
    this.statusSubject.next('disconnected');
  }

  /** Appends a locally-composed message optimistically (before server echo, if desired). */
  pushLocal(message: ChatMessage): void {
    this.messagesSubject.next([...this.messagesSubject.value, message]);
  }
}
