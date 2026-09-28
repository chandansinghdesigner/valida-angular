import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { ExamService } from '../../../core/services/exam.service';
import { Exam } from '../../../core/models/exam.model';

@Component({
  selector: 'app-instructions',
  standalone: true,
  imports: [NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navbar />
    <main class="v-page" style="max-width:820px">
      @if (exam(); as e) {
        <h1>{{ e.title }} — Instructions</h1>
        <p class="v-muted">{{ e.durationMinutes }} minutes · {{ e.totalQuestions }} questions · Pass mark {{ e.passingMarks }}/{{ e.totalMarks }}</p>

        <section class="v-card" style="margin:18px 0" aria-labelledby="req">
          <h2 id="req" style="font-size:17px;margin-top:0">Requirements</h2>
          <ul style="line-height:2;padding-left:20px;margin:0">
            @if (e.rules.camera) { <li>Camera required</li> }
            @if (e.rules.microphone) { <li>Microphone required</li> }
            @if (e.rules.screenShare) { <li>Screen sharing required (entire screen)</li> }
            @if (e.rules.fullscreen) { <li>Stay in fullscreen for the whole exam</li> }
            @if (e.rules.tabMonitoring) { <li>Do not switch tabs or windows</li> }
            @if (e.rules.blockClipboard) { <li>Copy, paste and right-click are disabled</li> }
            <li>Stable internet and a supported desktop browser</li>
            <li>Do not close the browser — answers are saved automatically</li>
          </ul>
        </section>

        <section class="v-card" style="margin-bottom:18px" aria-labelledby="priv">
          <h2 id="priv" style="font-size:17px;margin-top:0">Privacy &amp; monitoring notice</h2>
          <p class="v-muted" style="line-height:1.7;margin:0">
            During this exam your camera, microphone and screen are shared with your proctor through your browser,
            only after you grant permission. The application records proctoring events (for example leaving fullscreen or
            switching tabs) together with your answers. These events are signals a human reviewer may examine — they are
            not automatic findings. Data is retained according to your organisation's examination policy; contact your
            administrator for details.
          </p>
        </section>

        <label class="v-row" style="margin-bottom:18px;font-weight:600">
          <input type="checkbox" [checked]="agreed()" (change)="agreed.set(!agreed())" />
          I have read and understood the instructions and consent to the monitoring described above.
        </label>

        <div class="v-row">
          <button class="v-btn v-btn--ghost" type="button" (click)="router.navigate(['/candidate/exams'])">Back</button>
          <button class="v-btn" type="button" [disabled]="!agreed()" (click)="next()">Continue to System Check</button>
        </div>
      } @else if (error()) {
        <div class="v-alert v-alert--bad" role="alert">{{ error() }}</div>
      } @else {
        <p class="v-muted" role="status">Loading…</p>
      }
    </main>
  `
})
export class InstructionsComponent implements OnInit {
  id = input.required<string>();
  readonly router = inject(Router);
  private exams = inject(ExamService);

  exam = signal<Exam | null>(null);
  error = signal('');
  agreed = signal(false);

  ngOnInit(): void {
    this.exams.get(this.id()).subscribe({
      next: (e) => this.exam.set(e),
      error: () => this.error.set('This exam could not be loaded.')
    });
  }

  next(): void {
    this.exams.giveConsent(this.id());
    this.router.navigate(['/candidate/exams', this.id(), 'system-check']);
  }
}
