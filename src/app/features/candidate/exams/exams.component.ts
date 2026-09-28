import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { ExamService } from '../../../core/services/exam.service';
import { Exam } from '../../../core/models/exam.model';

@Component({
  selector: 'app-candidate-exams',
  standalone: true,
  imports: [DatePipe, NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navbar />
    <main class="v-page">
      <h1>Welcome, {{ name }}</h1>
      <p class="v-muted">Your assigned exams. You will complete a system check before each exam starts.</p>

      <div class="v-row" style="margin:18px 0">
        <span class="v-badge v-badge--info">Upcoming: {{ count('SCHEDULED') }}</span>
        <span class="v-badge v-badge--warn">Active: {{ count('ACTIVE') }}</span>
        <span class="v-badge v-badge--ok">Completed: {{ count('COMPLETED') }}</span>
      </div>

      @if (loading()) {
        <p class="v-muted" role="status">Loading exams…</p>
      } @else if (error()) {
        <div class="v-alert v-alert--bad" role="alert">{{ error() }}</div>
      } @else if (!exams().length) {
        <div class="v-card v-muted">No exams have been assigned to you yet.</div>
      } @else {
        <div class="v-grid">
          @for (e of exams(); track e.id) {
            <article class="v-card">
              <div class="v-row" style="justify-content:space-between">
                <h2 style="font-size:18px;margin:0">{{ e.title }}</h2>
                <span class="v-badge" [class]="badge(e)">{{ e.status }}</span>
              </div>
              <p class="v-muted">{{ e.description }}</p>
              <ul class="v-muted" style="line-height:1.9;margin:0 0 16px;padding-left:18px">
                <li>Date: {{ e.scheduledAt | date: 'dd MMM yyyy, HH:mm' }}</li>
                <li>Duration: {{ e.durationMinutes }} minutes</li>
                <li>Questions: {{ e.totalQuestions }}</li>
              </ul>
              @if (e.status === 'ACTIVE') {
                <button class="v-btn" type="button" (click)="open(e, 'instructions')">Start Exam</button>
              } @else if (e.status === 'COMPLETED') {
                <button class="v-btn v-btn--ghost" type="button" (click)="open(e, 'result')">View Result</button>
              } @else {
                <button class="v-btn v-btn--ghost" type="button" disabled>Not yet available</button>
              }
            </article>
          }
        </div>
      }
    </main>
  `
})
export class CandidateExamsComponent {
  private exam = inject(ExamService);
  private router = inject(Router);
  readonly name = inject(AuthService).currentUser?.name ?? 'Candidate';

  exams = signal<Exam[]>([]);
  loading = signal(true);
  error = signal('');

  constructor() {
    this.exam.assigned().subscribe({
      next: (list) => { this.exams.set(list); this.loading.set(false); },
      error: () => { this.error.set('Could not load your exams. Please try again.'); this.loading.set(false); }
    });
  }

  count(s: Exam['status']): number { return this.exams().filter((e) => e.status === s).length; }
  badge(e: Exam): string { return e.status === 'ACTIVE' ? 'v-badge--warn' : e.status === 'COMPLETED' ? 'v-badge--ok' : 'v-badge--info'; }
  open(e: Exam, page: string): void { this.router.navigate(['/candidate/exams', e.id, page]); }
}
