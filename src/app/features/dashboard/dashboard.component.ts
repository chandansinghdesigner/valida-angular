import { Component, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { AlertService } from '../../core/services/alert.service';
import { Candidate, ProctorStats } from '../../core/models/candidate.model';
import { AppNotification } from '../../core/models/notification.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private alerts = inject(AlertService);
  private sub = new Subscription();

  stats: ProctorStats = { activeProctors: 8, liveExams: 12, flagsTriggered: 3 };

  activeSession: Candidate | null = { id: '14523', name: 'Alex Wagner', examId: '14523', status: 'active' };

  candidates: Candidate[] = [
    { id: '1', name: 'Alex Wagner', examId: '14523', status: 'active' },
    { id: '2', name: 'Priya Sharma', examId: '15210', status: 'active' },
    { id: '3', name: 'Rahul Verma', examId: '14892', status: 'waiting' },
    { id: '4', name: 'Meera Nair', examId: '14711', status: 'completed' }
  ];

  notifications: AppNotification[] = [];

  ngOnInit(): void {
    this.alerts.seedMockData();
    this.alerts.loadHistory();
    this.alerts.connect();

    this.sub.add(
      this.alerts.notifications$.subscribe((list) => {
        this.notifications = list.slice(0, 3);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get unreadCount(): number {
    return this.alerts.unreadCount;
  }

  statusLabel(status: Candidate['status']): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'waiting':
        return 'Waiting';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
    }
  }

  /** Navigates the proctor into the live WebRTC + chat workspace for a candidate. */
  startProctoring(candidate: Candidate): void {
    this.activeSession = candidate;
    this.router.navigate(['/live-proctoring', candidate.examId]);
  }

  /** Ends the currently highlighted proctoring session card on this page. */
  endProctoring(): void {
    if (!this.activeSession) return;
    this.candidates = this.candidates.map((c) =>
      c.id === this.activeSession?.id ? { ...c, status: 'completed' } : c
    );
    this.activeSession = null;
  }
}
