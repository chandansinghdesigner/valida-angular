import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { CheckResult, MediaSessionService } from '../../../core/services/media-session.service';
import { ExamService } from '../../../core/services/exam.service';
import { Exam } from '../../../core/models/exam.model';

type Key = 'browser' | 'network' | 'webrtc' | 'camera' | 'microphone' | 'screen';
const PENDING: CheckResult = { status: 'pending', detail: 'Not checked yet' };

@Component({
  selector: 'app-system-check',
  standalone: true,
  imports: [NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navbar />
    <main class="v-page" style="max-width:900px">
      <h1>System Check</h1>
      <p class="v-muted">Every item marked required must pass before the exam can start.</p>

      <div class="v-grid" style="grid-template-columns:2fr 1fr;margin-top:18px">
        <section class="v-card" aria-label="Checks">
          @for (row of rows(); track row.key) {
            <div class="v-row" style="justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border-subtle)">
              <div>
                <strong>{{ row.label }}</strong>@if (!row.required) { <span class="v-muted"> (optional)</span> }
                <div class="v-muted" [attr.role]="row.result.status === 'fail' ? 'alert' : null">{{ row.result.detail }}</div>
              </div>
              <span class="v-badge" [class]="badge(row.result)">
                {{ row.result.status === 'ok' ? '✓ Ready' : row.result.status === 'fail' ? '✕ Failed' : 'Pending' }}
              </span>
            </div>
          }
          <div class="v-row" style="margin-top:18px">
            <button class="v-btn v-btn--ghost" type="button" (click)="runAuto()">Re-run basic checks</button>
            <button class="v-btn" type="button" (click)="allowCamera()">Allow Camera &amp; Microphone</button>
            @if (exam()?.rules?.screenShare) {
              <button class="v-btn" type="button" (click)="shareScreen()">Share Screen</button>
            }
          </div>
        </section>

        <section class="v-card" aria-label="Camera preview">
          <video #preview autoplay muted playsinline style="width:100%;border-radius:12px;background:#10213E;aspect-ratio:4/3"></video>
          <p class="v-muted" style="margin:8px 0 0">Camera preview (local only)</p>
        </section>
      </div>

      <p class="v-muted" style="margin-top:14px">
        Face detection and identity verification are not part of this check; they require a verification provider to be configured.
      </p>
      <div class="v-row" style="margin-top:18px">
        <button class="v-btn v-btn--ghost" type="button" (click)="back()">Back</button>
        <button class="v-btn" type="button" [disabled]="!ready()" (click)="start()">Continue to Exam</button>
      </div>
    </main>
  `
})
export class SystemCheckComponent implements OnInit, OnDestroy {
  id = input.required<string>();
  private media = inject(MediaSessionService);
  private exams = inject(ExamService);
  private router = inject(Router);

  exam = signal<Exam | null>(null);
  private results = signal<Record<Key, CheckResult>>({
    browser: PENDING, network: PENDING, webrtc: PENDING, camera: PENDING, microphone: PENDING, screen: PENDING
  });
  private proceeding = false;
  private video?: HTMLVideoElement;

  @ViewChild('preview') set preview(el: ElementRef<HTMLVideoElement> | undefined) {
    this.video = el?.nativeElement;
    if (this.video) this.video.srcObject = this.media.cameraStream();
  }

  rows = computed(() => {
    const r = this.results();
    const rules = this.exam()?.rules;
    const all: { key: Key; label: string; required: boolean }[] = [
      { key: 'browser', label: 'Browser', required: true },
      { key: 'network', label: 'Network', required: true },
      { key: 'webrtc', label: 'WebRTC', required: true },
      { key: 'camera', label: 'Camera', required: rules?.camera ?? true },
      { key: 'microphone', label: 'Microphone', required: rules?.microphone ?? true },
      { key: 'screen', label: 'Screen sharing', required: rules?.screenShare ?? true }
    ];
    return all.filter((x) => x.required || x.key !== 'screen').map((x) => ({ ...x, result: r[x.key] }));
  });
  ready = computed(() => this.rows().every((x) => !x.required || x.result.status === 'ok'));

  constructor() {
    effect(() => {
      const stream = this.media.cameraStream();
      if (this.video) this.video.srcObject = stream;
    });
  }

  ngOnInit(): void {
    this.exams.get(this.id()).subscribe((e) => this.exam.set(e));
    void this.runAuto();
  }

  ngOnDestroy(): void {
    // Keep streams alive only when moving on to the exam.
    if (!this.proceeding) this.media.stopAll();
  }

  async runAuto(): Promise<void> {
    this.set('browser', this.media.checkBrowser());
    this.set('network', this.media.checkNetwork());
    this.set('webrtc', await this.media.checkWebRtc());
  }

  async allowCamera(): Promise<void> {
    const r = await this.media.requestCameraAndMic();
    this.set('camera', r.camera);
    this.set('microphone', r.microphone);
  }

  async shareScreen(): Promise<void> { this.set('screen', await this.media.requestScreen()); }

  back(): void { this.router.navigate(['/candidate/exams', this.id(), 'instructions']); }

  start(): void {
    this.proceeding = true;
    this.exams.markReady(this.id());
    this.router.navigate(['/candidate/exams', this.id(), 'start']);
  }

  badge(r: CheckResult): string { return r.status === 'ok' ? 'v-badge--ok' : r.status === 'fail' ? 'v-badge--bad' : 'v-badge--idle'; }
  private set(k: Key, r: CheckResult): void { this.results.update((cur) => ({ ...cur, [k]: r })); }
}
