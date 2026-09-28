import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { ExamService } from '../../../core/services/exam.service';
import { ExamResult } from '../../../core/models/exam.model';

@Component({
  selector: 'app-exam-result',
  standalone: true,
  imports: [NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navbar />
    <main class="v-page" style="max-width:760px">
      @if (result(); as r) {
        <h1>Exam Completed</h1>
        @if (r.demo) { <div class="v-alert v-alert--warn" role="note" style="margin:12px 0">Demo mode: no API was reachable, so this score is simulated.</div> }
        <section class="v-card" style="margin-top:16px">
          <div class="v-row" style="justify-content:space-between">
            <div><div class="v-muted">Score</div><div style="font-size:34px;font-weight:800">{{ r.score }} / {{ r.totalMarks }}</div></div>
            <div><div class="v-muted">Percentage</div><div style="font-size:34px;font-weight:800">{{ r.percentage }}%</div></div>
            <span class="v-badge" [class]="r.passed ? 'v-badge--ok' : 'v-badge--bad'" style="font-size:15px">{{ r.passed ? 'PASSED' : 'NOT PASSED' }}</span>
          </div>
          <table class="v-table" style="margin-top:20px">
            <tr><th>Correct</th><td>{{ r.correct }}</td></tr>
            <tr><th>Incorrect</th><td>{{ r.incorrect }}</td></tr>
            <tr><th>Skipped</th><td>{{ r.skipped }}</td></tr>
            <tr><th>Time used</th><td>{{ time(r.timeUsedSeconds) }}</td></tr>
          </table>
        </section>
        <button class="v-btn" style="margin-top:20px" type="button" (click)="router.navigate(['/candidate/exams'])">Back to My Exams</button>
      } @else if (error()) {
        <div class="v-alert v-alert--bad" role="alert">{{ error() }}</div>
      } @else { <p class="v-muted" role="status">Loading result…</p> }
    </main>
  `
})
export class ExamResultComponent implements OnInit {
  id = input.required<string>();
  readonly router = inject(Router);
  private exams = inject(ExamService);
  result = signal<ExamResult | null>(null);
  error = signal('');

  ngOnInit(): void {
    this.exams.result(this.id()).subscribe({
      next: (r) => this.result.set(r),
      error: () => this.error.set('Your result is not available yet.')
    });
  }

  time(s: number): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  }
}
