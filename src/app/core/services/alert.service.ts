import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private hubConnection: signalR.HubConnection | null = null;

  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  readonly notifications$ = this.notificationsSubject.asObservable();

  /** Fires for every new push — components use it to show a toast/sound. */
  readonly newAlert$ = new Subject<AppNotification>();

  get unreadCount(): number {
    return this.notificationsSubject.value.filter((n) => !n.read).length;
  }

  /** Loads notification history from the REST API. */
  async loadHistory(): Promise<void> {
    try {
      const history = await firstValueFrom(
        this.http.get<AppNotification[]>(`${environment.apiBaseUrl}/notifications`)
      );
      this.notificationsSubject.next(
        history.map((n) => ({ ...n, timestamp: new Date(n.timestamp) }))
      );
    } catch {
      // No backend yet — leave the feed empty rather than failing the page.
      this.notificationsSubject.next([]);
    }
  }

  /** Opens the SignalR connection that pushes live suspicious-activity flags and system events. */
  async connect(): Promise<void> {
    if (this.hubConnection) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.alertsHubUrl, {
        accessTokenFactory: () => this.auth.getToken() ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.hubConnection.on('NewAlert', (payload: Omit<AppNotification, 'timestamp'> & { timestamp: string }) => {
      const notification: AppNotification = { ...payload, timestamp: new Date(payload.timestamp) };
      this.notificationsSubject.next([notification, ...this.notificationsSubject.value]);
      this.newAlert$.next(notification);
    });

    try {
      await this.hubConnection.start();
    } catch {
      // Backend may not be running yet in dev; the UI still works off mock/local data.
      this.hubConnection = null;
    }
  }

  async disconnect(): Promise<void> {
    await this.hubConnection?.stop();
    this.hubConnection = null;
  }

  markAsRead(id: string): void {
    this.notificationsSubject.next(
      this.notificationsSubject.value.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  markAllAsRead(): void {
    this.notificationsSubject.next(this.notificationsSubject.value.map((n) => ({ ...n, read: true })));
  }

  /** Seeds the feed with demo data so the UI has something to render without a backend. */
  seedMockData(): void {
    const now = Date.now();
    const mock: AppNotification[] = [
      { id: '1', title: 'Exam Started', message: 'Candidate Priya started the exam.', severity: 'warning', category: 'exam', timestamp: new Date(now - 60_000), read: false },
      { id: '2', title: 'Suspicious Activity Detected', message: 'Unusual activity detected in Exam ID: 15210.', severity: 'danger', category: 'security', timestamp: new Date(now - 2 * 60_000), read: false },
      { id: '3', title: 'Candidate Completed Exam', message: 'Rahul Verma completed the exam (Exam ID: 14892).', severity: 'info', category: 'exam', timestamp: new Date(now - 15 * 60_000), read: false },
      { id: '4', title: 'System Update', message: 'Live Proctoring system updated to version 2.4.0.', severity: 'success', category: 'system', timestamp: new Date(now - 3 * 3_600_000), read: true }
    ];
    this.notificationsSubject.next(mock);
  }
}
