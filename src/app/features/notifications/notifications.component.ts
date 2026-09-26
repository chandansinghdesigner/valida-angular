import { Component, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { AlertService } from '../../core/services/alert.service';
import { AppNotification, NotificationCategory } from '../../core/models/notification.model';

type FilterKey = 'all' | NotificationCategory;

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private alerts = inject(AlertService);
  private sub = new Subscription();

  all: AppNotification[] = [];
  currentFilter: FilterKey = 'all';
  unreadOnly = false;

  readonly tabs: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'exam', label: 'Exam Updates' },
    { key: 'system', label: 'System Alerts' },
    { key: 'account', label: 'Account' },
    { key: 'security', label: 'Security' }
  ];

  ngOnInit(): void {
    this.alerts.seedMockData();
    this.alerts.loadHistory();
    this.alerts.connect();

    this.sub.add(this.alerts.notifications$.subscribe((list) => (this.all = list)));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get filtered(): AppNotification[] {
    return this.all.filter((n) => {
      const categoryMatch = this.currentFilter === 'all' || n.category === this.currentFilter;
      const unreadMatch = !this.unreadOnly || !n.read;
      return categoryMatch && unreadMatch;
    });
  }

  get unreadCount(): number {
    return this.alerts.unreadCount;
  }

  countFor(filter: FilterKey): number {
    return filter === 'all' ? this.all.length : this.all.filter((n) => n.category === filter).length;
  }

  setFilter(filter: FilterKey): void {
    this.currentFilter = filter;
  }

  toggleUnreadOnly(): void {
    this.unreadOnly = !this.unreadOnly;
  }

  open(notification: AppNotification): void {
    this.alerts.markAsRead(notification.id);
  }

  markAllAsRead(): void {
    this.alerts.markAllAsRead();
  }

  iconFor(notification: AppNotification): string {
    switch (notification.severity) {
      case 'danger':
        return '!';
      case 'warning':
        return '◷';
      case 'success':
        return '✓';
      default:
        return 'i';
    }
  }

  severityClass(notification: AppNotification): string {
    switch (notification.severity) {
      case 'danger':
        return 'red';
      case 'warning':
        return 'orange';
      case 'success':
        return 'teal';
      default:
        return 'blue';
    }
  }
}
