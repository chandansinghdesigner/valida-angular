import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProctoringEvent, ProctoringEventType, ProctoringRules } from '../models/exam.model';

/** Operational severity per event type — thresholds are policy, final decisions are human. */
const SEVERITY: Record<ProctoringEventType, ProctoringEvent['severity']> = {
  SCREEN_SHARE_STOPPED: 'HIGH', CAMERA_DISCONNECTED: 'HIGH', MICROPHONE_DISCONNECTED: 'MEDIUM',
  FULLSCREEN_EXIT: 'MEDIUM', TAB_HIDDEN: 'MEDIUM', WINDOW_BLUR: 'LOW',
  COPY_ATTEMPT: 'LOW', PASTE_ATTEMPT: 'LOW', CUT_ATTEMPT: 'LOW', CONTEXT_MENU_ATTEMPT: 'LOW',
  NETWORK_DISCONNECTED: 'MEDIUM', NETWORK_RESTORED: 'LOW'
};
const MESSAGES: Partial<Record<ProctoringEventType, string>> = {
  FULLSCREEN_EXIT: 'You left fullscreen. Please return to fullscreen to continue.',
  TAB_HIDDEN: 'Switching tabs is not allowed during this exam.',
  SCREEN_SHARE_STOPPED: 'Screen sharing stopped. Please contact your proctor.',
  CAMERA_DISCONNECTED: 'Your camera was disconnected.',
  COPY_ATTEMPT: 'Copying is disabled for this exam.',
  PASTE_ATTEMPT: 'Pasting is disabled for this exam.',
  CUT_ATTEMPT: 'Cutting is disabled for this exam.',
  NETWORK_DISCONNECTED: 'You are offline. Answers will sync when the connection returns.'
};
const DEDUPE_MS = 2000;

/**
 * Browser-detectable proctoring signals only (fullscreen, visibility, focus,
 * clipboard, connectivity, device tracks). These APIs cannot see other
 * applications or devices, so events are review signals — not proof of cheating.
 */
@Injectable({ providedIn: 'root' })
export class ProctoringEventsService {
  private http = inject(HttpClient);
  private sessionId = '';
  private rules: ProctoringRules | null = null;
  private lastEmit = new Map<ProctoringEventType, number>();
  private cleanup: (() => void)[] = [];

  readonly events = signal<ProctoringEvent[]>([]);
  readonly warning = signal<string | null>(null);

  start(sessionId: string, rules: ProctoringRules): void {
    this.stop();
    this.sessionId = sessionId;
    this.rules = rules;
    this.events.set([]);

    const on = <T extends EventTarget>(t: T, ev: string, fn: (e: Event) => void) => {
      t.addEventListener(ev, fn);
      this.cleanup.push(() => t.removeEventListener(ev, fn));
    };

    if (rules.fullscreen) {
      on(document, 'fullscreenchange', () => { if (!document.fullscreenElement) this.report('FULLSCREEN_EXIT'); });
    }
    if (rules.tabMonitoring) {
      on(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') this.report('TAB_HIDDEN'); });
      // blur also fires when the tab is hidden; skip it if TAB_HIDDEN just fired.
      on(window, 'blur', () => setTimeout(() => {
        if (document.visibilityState === 'visible') this.report('WINDOW_BLUR');
      }, 300));
    }
    if (rules.blockClipboard) {
      const map: [string, ProctoringEventType][] = [
        ['copy', 'COPY_ATTEMPT'], ['paste', 'PASTE_ATTEMPT'], ['cut', 'CUT_ATTEMPT'], ['contextmenu', 'CONTEXT_MENU_ATTEMPT']
      ];
      map.forEach(([ev, type]) => on(document, ev, (e) => { e.preventDefault(); this.report(type); }));
    }
    on(window, 'offline', () => this.report('NETWORK_DISCONNECTED'));
    on(window, 'online', () => this.report('NETWORK_RESTORED'));
  }

  stop(): void {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.lastEmit.clear();
    this.warning.set(null);
  }

  dismissWarning(): void { this.warning.set(null); }

  /** Records an event (deduplicated) and posts it to the API; failures never block the exam. */
  report(type: ProctoringEventType, metadata?: Record<string, unknown>): void {
    if (!this.rules) return;
    const now = Date.now();
    if (now - (this.lastEmit.get(type) ?? 0) < DEDUPE_MS) return;
    this.lastEmit.set(type, now);

    const event: ProctoringEvent = {
      id: crypto.randomUUID(), sessionId: this.sessionId, type, source: 'BROWSER',
      severity: SEVERITY[type], timestamp: new Date(now).toISOString(), metadata
    };
    this.events.update((list) => [event, ...list].slice(0, 100));
    const message = MESSAGES[type];
    if (message) this.warning.set(message);

    this.http.post(`${environment.apiBaseUrl}/proctoring/events`, event).pipe(catchError(() => of(null))).subscribe();
  }
}
