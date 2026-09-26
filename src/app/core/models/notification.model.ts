export type NotificationSeverity = 'info' | 'warning' | 'danger' | 'success';
export type NotificationCategory = 'exam' | 'system' | 'account' | 'security';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  timestamp: Date;
  read: boolean;
}
