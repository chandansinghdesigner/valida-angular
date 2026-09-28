import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { ExamService } from '../../../core/services/exam.service';
import { MediaSessionService } from '../../../core/services/media-session.service';
import { ProctoringEventsService } from '../../../core/services/proctoring-events.service';
import { AnswerValue, Exam, ExamSession, Question, QuestionState } from '../../../core/models/exam.model';

const isAnswered = (v: AnswerValue | undefined): boolean =>
  Array.isArray(v) ? v.length > 0 : (v ?? '').trim().length > 0;

@Component({
  selector: 'app-exam',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exam.component.html',
  styleUrl: './exam.component.css'
})
export class ExamComponent implements OnInit, OnDestroy {
  id = input.required<string>();
  private exams = inject(ExamService);
  private media = inject(MediaSessionService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  readonly proctoring = inject(ProctoringEventsService);

  exam = signal<Exam | null>(null);
  questions = signal<Question[]>([]);
  session = signal<ExamSession | null>(null);
  loadError = signal('');
  started = signal(false);
  submitting = signal(false);
  submitOpen = signal(false);
  saveState = signal<'saved' | 'saving' | 'pending'>('saved');

  index = signal(0);
  answers = signal<Record<string, AnswerValue>>({});
  visited = signal<ReadonlySet<string>>(new Set());
  marked = signal<ReadonlySet<string>>(new Set());

  /** Server time offset: (serverTime - client clock) at session start. */
  private offsetMs = 0;
  private now = signal(Date.now());
  private tick?: ReturnType<typeof setInterval>;
  private pending = new Map<string, AnswerValue>();
  private changes$ = new Subject<void>();
  private done = false;

  current = computed(() => this.questions()[this.index()]);
  remainingSeconds = computed(() => {
    const s = this.session();
    if (!s) return 0;
    return Math.max(0, Math.floor((Date.parse(s.endTime) - (this.now() + this.offsetMs)) / 1000));
  });
  clock = computed(() => {
    const t = this.remainingSeconds();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
  });
  answeredCount = computed(() => this.questions().filter((q) => isAnswered(this.answers()[q.id])).length);
  markedCount = computed(() => this.marked().size);
  cameraStream = this.media.cameraStream;
  screenActive = computed(() => !!this.media.screenStream());

  @ViewChild('cam') set cam(el: ElementRef<HTMLVideoElement> | undefined) {
    if (el) el.nativeElement.srcObject = this.media.cameraStream();
  }

  constructor() {
    effect(() => { if (this.started() && this.remainingSeconds() === 0 && !this.done) void this.submit(true); });
    this.changes$.pipe(debounceTime(500), takeUntilDestroyed()).subscribe(() => void this.flush());
    this.media.trackEnded$.pipe(takeUntilDestroyed()).subscribe((kind) => {
      const type = kind === 'screen' ? 'SCREEN_SHARE_STOPPED' : kind === 'camera' ? 'CAMERA_DISCONNECTED' : 'MICROPHONE_DISCONNECTED';
      this.proctoring.report(type);
    });
  }

  ngOnInit(): void {
    const id = this.id();
    this.exams.get(id).subscribe({ next: (e) => this.exam.set(e), error: () => this.loadError.set('This exam could not be loaded.') });
    this.exams.questions(id).subscribe({ next: (q) => this.questions.set(q), error: () => this.loadError.set('Questions could not be loaded.') });
  }

  ngOnDestroy(): void { this.teardown(); }

  @HostListener('window:online') onOnline(): void { void this.flush(); }
  @HostListener('window:beforeunload', ['$event']) onUnload(e: BeforeUnloadEvent): void {
    if (this.started() && !this.done) e.preventDefault();
  }

  /** Begin: starts the server session, enters fullscreen (needs this click) and starts monitoring. */
  async begin(): Promise<void> {
    const exam = this.exam();
    if (!exam) return;
    try {
      const session = await firstValueFrom(this.exams.startSession(this.id()));
      this.offsetMs = Date.parse(session.serverTime) - Date.now();
      this.session.set(session);
    } catch {
      this.loadError.set('Could not start the exam session. Please try again.');
      return;
    }
    if (exam.rules.fullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch { /* proctoring will log if it is missing */ }
    }
    this.proctoring.start(this.session()!.id, exam.rules);
    this.tick = setInterval(() => this.now.set(Date.now()), 1000);
    this.visit(0);
    this.started.set(true);
  }

  reenterFullscreen(): void {
    void document.documentElement.requestFullscreen().catch(() => undefined);
    this.proctoring.dismissWarning();
  }

  // --- answering & navigation -------------------------------------------------
  state(q: Question): QuestionState {
    const answered = isAnswered(this.answers()[q.id]);
    const marked = this.marked().has(q.id);
    if (answered && marked) return 'ANSWERED_AND_MARKED';
    if (marked) return 'MARKED_FOR_REVIEW';
    if (answered) return 'ANSWERED';
    return this.visited().has(q.id) ? 'VISITED' : 'NOT_VISITED';
  }

  selected(q: Question, optionId: string): boolean {
    const v = this.answers()[q.id];
    return Array.isArray(v) ? v.includes(optionId) : v === optionId;
  }

  text(q: Question): string {
    const v = this.answers()[q.id];
    return typeof v === 'string' ? v : '';
  }

  choose(q: Question, optionId: string): void {
    if (q.type === 'MULTIPLE') {
      const cur = this.answers()[q.id];
      const list = Array.isArray(cur) ? cur : [];
      this.setAnswer(q, list.includes(optionId) ? list.filter((x) => x !== optionId) : [...list, optionId]);
    } else {
      this.setAnswer(q, optionId);
    }
  }

  setAnswer(q: Question, value: AnswerValue): void {
    this.answers.update((a) => ({ ...a, [q.id]: value }));
    this.pending.set(q.id, value);
    this.saveState.set('pending');
    this.changes$.next();
  }

  toggleMark(): void {
    const q = this.current();
    if (!q) return;
    this.marked.update((m) => { const n = new Set(m); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; });
  }

  go(i: number): void {
    if (i < 0 || i >= this.questions().length) return;
    this.index.set(i);
    this.visit(i);
    void this.flush();
  }

  saveNext(): void {
    if (this.index() >= this.questions().length - 1) this.submitOpen.set(true);
    else this.go(this.index() + 1);
  }

  private visit(i: number): void {
    const q = this.questions()[i];
    if (q) this.visited.update((v) => new Set(v).add(q.id));
  }

  /** Sends pending answers; anything that fails stays queued and is retried on the next change / `online` event. */
  private async flush(): Promise<void> {
    const session = this.session();
    if (!session || !this.pending.size) { this.saveState.set(this.pending.size ? 'pending' : 'saved'); return; }
    if (!navigator.onLine) { this.saveState.set('pending'); return; }
    this.saveState.set('saving');
    for (const [questionId, value] of [...this.pending]) {
      try {
        await firstValueFrom(this.exams.saveAnswer(session.id, { questionId, value }));
        if (this.pending.get(questionId) === value) this.pending.delete(questionId);
      } catch { /* keep queued */ }
    }
    this.saveState.set(this.pending.size ? 'pending' : 'saved');
  }

  // --- submission -------------------------------------------------------------
  async submit(auto = false): Promise<void> {
    const session = this.session();
    if (!session || this.submitting() || this.done) return;
    this.submitting.set(true);
    this.submitOpen.set(false);
    await this.flush();
    try {
      const timeUsed = Math.floor((this.now() + this.offsetMs - Date.parse(session.startTime)) / 1000);
      await firstValueFrom(this.exams.submit(session.id, this.id(), {
        answered: this.answeredCount(), total: this.questions().length,
        timeUsedSeconds: Math.max(0, timeUsed), auto
      }));
      this.done = true;
      this.teardown();
      this.exams.clearGates(this.id());
      await this.router.navigate(['/candidate/exams', this.id(), 'result']);
    } catch {
      this.submitting.set(false);
      this.loadError.set('Submission failed. Check your connection and try again — your answers are saved.');
    }
  }

  private teardown(): void {
    if (this.tick) clearInterval(this.tick);
    this.proctoring.stop();
    this.media.stopAll();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }
}
