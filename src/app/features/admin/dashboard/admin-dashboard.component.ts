import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { ExamService } from '../../../core/services/exam.service';
import { AdminStats, Exam } from '../../../core/models/exam.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [DatePipe, NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navbar />
    <main class="v-page">
      <h1>Admin Dashboard</h1>
      <p class="v-muted">Overview of exams, sessions and proctoring activity.</p>
      @if (error()) { <div class="v-alert v-alert--bad" role="alert" style="margin-top:16px">{{ error() }}</div> }
      @if (stats(); as s) {
        <div class="v-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin:20px 0">
          @for (c of cards(s); track c[0]) {
            <div class="v-card"><div class="v-muted">{{ c[0] }}</div><div style="font-size:28px;font-weight:800">{{ c[1] }}</div></div>
          }
        </div>
      }
      <section class="v-card" aria-labelledby="ex-h">
        <h2 id="ex-h" style="font-size:17px;margin-top:0">Exams</h2>
        <div style="overflow-x:auto">
          <table class="v-table">
            <thead><tr><th>Title</th><th>Scheduled</th><th>Duration</th><th>Questions</th><th>Status</th></tr></thead>
            <tbody>
              @for (e of exams(); track e.id) {
                <tr><td>{{ e.title }}</td><td>{{ e.scheduledAt | date: 'dd MMM yyyy' }}</td><td>{{ e.durationMinutes }} min</td>
                  <td>{{ e.totalQuestions }}</td><td><span class="v-badge v-badge--info">{{ e.status }}</span></td></tr>
              } @empty { <tr><td colspan="5" class="v-muted">No exams found.</td></tr> }
            </tbody>
          </table>
        </div>
      </section>
    </main>
  `
})
export class AdminDashboardComponent {
  private api = inject(ExamService);
  stats = signal<AdminStats | null>(null);
  exams = signal<Exam[]>([]);
  error = signal('');

  constructor() {
    this.api.adminStats().subscribe({ next: (s) => this.stats.set(s), error: () => this.error.set('Statistics could not be loaded.') });
    this.api.adminExams().subscribe({ next: (e) => this.exams.set(e), error: () => this.error.set('Exams could not be loaded.') });
  }

  cards(s: AdminStats): [string, string | number][] {
    return [['Total exams', s.totalExams], ['Active exams', s.activeExams], ['Candidates', s.candidates], ['Proctors', s.proctors],
      ['Completed', s.completedExams], ['Live sessions', s.liveSessions], ['Alerts', s.alerts], ['Average score', s.averageScore + '%']];
  }
}
